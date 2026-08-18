import { Test, TestingModule } from '@nestjs/testing';
import { AccessResponseConsumer } from '../../src/infrastructure/messaging/consumers/access-response.consumer';
import { AmqpService } from '../../src/infrastructure/messaging/amqp.service';
import { TransactionService } from '../../src/modules/transaction/transaction.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { AppLogger } from '../../src/common/logger/logger.service';
import {
  mockAppLogger,
  createMockAmqpService,
  createMockTransactionService,
  createMockPrismaService,
  MockAmqpService,
  MockTransactionService,
  MockPrismaService,
} from './jest-setup';
import { TransactionStatus } from '../../src/modules/transaction/dto/update-status.dto';

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-1234'),
}));

describe('AccessResponseConsumer', () => {
  let consumer: AccessResponseConsumer;
  let amqpService: MockAmqpService;
  let transactionService: MockTransactionService;
  let prismaService: MockPrismaService;

  const mockTransaction = {
    id: 'mock-txn-id',
    type: 'CHECK_IN',
    applicationId: 'app-123',
    processorCode: 'WRP001',
    webhookUrl: 'https://example.com/webhook',
    venueId: 'venue-1',
    status: 'PENDING' as TransactionStatus,
    errorCode: null,
    errorMessage: null,
    params: { member_uid: 'MBR001' },
    retryCount: 0,
    processorApplicationId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    application: {
      id: 'app-123',
      code: 'HST001',
      webhookSecret: 'hst-secret',
    },
  };

  const createMessage = (data: any) => ({
    id: 'msg-123',
    correlation_id: 'corr-123',
    timestamp: new Date(),
    data,
  });

  beforeEach(async () => {
    amqpService = createMockAmqpService();
    transactionService = createMockTransactionService();
    prismaService = createMockPrismaService();

    transactionService.findById.mockResolvedValue(mockTransaction);
    amqpService.publishWebhook.mockResolvedValue(undefined);

    // Mock $transaction to execute callback immediately
    prismaService.$transaction = jest.fn().mockImplementation((callback) => {
      return callback(prismaService as any);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccessResponseConsumer,
        { provide: AmqpService, useValue: amqpService },
        { provide: TransactionService, useValue: transactionService },
        { provide: PrismaService, useValue: prismaService },
        { provide: AppLogger, useValue: mockAppLogger },
      ],
    }).compile();

    consumer = module.get<AccessResponseConsumer>(AccessResponseConsumer);
  });

  describe('handleResponse', () => {
    it('should update transaction to PROCESSING and publish webhook', async () => {
      const message = createMessage({
        transaction_id: 'mock-txn-id',
        status: 'success',
        processed_at: '2024-01-01T00:00:00Z',
      });

      await consumer['handleResponse'](message);

      expect(prismaService.$transaction).toHaveBeenCalled();
      expect(amqpService.publishWebhook).toHaveBeenCalledWith({
        transactionId: 'mock-txn-id',
        webhookUrl: 'https://example.com/webhook',
        payload: expect.objectContaining({
          transaction_id: 'mock-txn-id',
          status: 'success',
          member_uid: 'MBR001',
        }),
        webhookSecret: 'hst-secret',
        attempt: 1,
        processorCode: 'WRP001',
      });
    });

    it('should throw when transaction_id is missing (NACK → DLQ)', async () => {
      const message = createMessage({
        status: 'success',
      });

      await expect(consumer['handleResponse'](message)).rejects.toThrow(
        'Missing transaction_id in access response',
      );
    });

    it('should throw when transaction is not found (NACK → DLQ)', async () => {
      transactionService.findById.mockResolvedValue(null);

      const message = createMessage({
        transaction_id: 'non-existent-id',
        status: 'success',
      });

      await expect(consumer['handleResponse'](message)).rejects.toThrow(
        'Transaction not found: non-existent-id',
      );
    });

    it('should ACK (return) when transaction is already SUCCESS', async () => {
      transactionService.findById.mockResolvedValue({
        ...mockTransaction,
        status: TransactionStatus.SUCCESS,
      });

      const message = createMessage({
        transaction_id: 'mock-txn-id',
        status: 'success',
      });

      await consumer['handleResponse'](message);

      expect(prismaService.$transaction).not.toHaveBeenCalled();
      expect(amqpService.publishWebhook).not.toHaveBeenCalled();
    });

    it('should ACK (return) when transaction is already FAILED', async () => {
      transactionService.findById.mockResolvedValue({
        ...mockTransaction,
        status: TransactionStatus.FAILED,
      });

      const message = createMessage({
        transaction_id: 'mock-txn-id',
        status: 'failed',
      });

      await consumer['handleResponse'](message);

      expect(prismaService.$transaction).not.toHaveBeenCalled();
      expect(amqpService.publishWebhook).not.toHaveBeenCalled();
    });

    it('should handle webhook publish failure gracefully', async () => {
      amqpService.publishWebhook.mockRejectedValue(
        new Error('Queue unavailable'),
      );

      const message = createMessage({
        transaction_id: 'mock-txn-id',
        status: 'success',
      });

      // Should not throw - webhook publish failure is non-critical
      await expect(consumer['handleResponse'](message)).resolves.not.toThrow();

      expect(mockAppLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Webhook publish failed'),
        undefined,
        'AccessResponseConsumer',
      );
    });

    it('should NOT publish webhook when webhookUrl is null', async () => {
      transactionService.findById.mockResolvedValue({
        ...mockTransaction,
        webhookUrl: null,
      });

      const message = createMessage({
        transaction_id: 'mock-txn-id',
        status: 'success',
      });

      await consumer['handleResponse'](message);

      expect(prismaService.$transaction).toHaveBeenCalled();
      expect(amqpService.publishWebhook).not.toHaveBeenCalled();
    });

    it('should use default webhook secret when application is null', async () => {
      transactionService.findById.mockResolvedValue({
        ...mockTransaction,
        application: null,
      });

      const message = createMessage({
        transaction_id: 'mock-txn-id',
        status: 'success',
      });

      await consumer['handleResponse'](message);

      expect(amqpService.publishWebhook).toHaveBeenCalledWith(
        expect.objectContaining({
          webhookSecret: 'default-secret',
        }),
      );
    });

    it('should throw when database transaction fails', async () => {
      prismaService.$transaction = jest
        .fn()
        .mockRejectedValue(new Error('Database connection lost'));

      const message = createMessage({
        transaction_id: 'mock-txn-id',
        status: 'success',
      });

      await expect(consumer['handleResponse'](message)).rejects.toThrow(
        'Database connection lost',
      );
    });
  });
});
