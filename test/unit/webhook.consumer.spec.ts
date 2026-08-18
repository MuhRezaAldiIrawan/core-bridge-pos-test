import { Test, TestingModule } from '@nestjs/testing';
import {
  WebhookConsumer,
  WebhookQueueMessage,
} from '../../src/infrastructure/messaging/consumers/webhook.consumer';
import { AmqpService } from '../../src/infrastructure/messaging/amqp.service';
import { TransactionService } from '../../src/modules/transaction/transaction.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { WebhookService } from '../../src/modules/webhook/webhook.service';
import { AppLogger } from '../../src/common/logger/logger.service';
import {
  mockAppLogger,
  createMockAmqpService,
  createMockTransactionService,
  createMockPrismaService,
  createMockWebhookService,
  MockAmqpService,
  MockTransactionService,
  MockPrismaService,
  MockWebhookService,
} from './jest-setup';
import { TransactionStatus } from '../../src/modules/transaction/dto/update-status.dto';

describe('WebhookConsumer', () => {
  let consumer: WebhookConsumer;
  let amqpService: MockAmqpService;
  let transactionService: MockTransactionService;
  let webhookService: MockWebhookService;
  let prismaService: MockPrismaService;

  const createMessage = (
    overrides: Partial<WebhookQueueMessage> = {},
  ): WebhookQueueMessage => ({
    transactionId: 'mock-txn-id',
    webhookUrl: 'https://example.com/webhook',
    payload: {
      transaction_id: 'mock-txn-id',
      status: 'success',
      processed_at: '2026-08-10T10:00:00.000Z',
      error_code: null,
      error_message: null,
    },
    webhookSecret: 'test-secret',
    attempt: 1,
    processorCode: 'WRP001',
    ...overrides,
  });

  beforeEach(async () => {
    amqpService = createMockAmqpService();
    transactionService = createMockTransactionService();
    webhookService = createMockWebhookService();
    prismaService = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookConsumer,
        { provide: AmqpService, useValue: amqpService },
        { provide: TransactionService, useValue: transactionService },
        { provide: WebhookService, useValue: webhookService },
        { provide: PrismaService, useValue: prismaService },
        { provide: AppLogger, useValue: mockAppLogger },
      ],
    }).compile();

    consumer = module.get<WebhookConsumer>(WebhookConsumer);
  });

  describe('handleWebhook', () => {
    it('should update transaction to SUCCESS when HST returns 200', async () => {
      webhookService.send.mockResolvedValue({
        success: true,
        httpStatus: 200,
        responseBody: '{"status":"ok"}',
      });
      transactionService.updateStatus.mockResolvedValue({
        id: 'mock-txn-id',
        status: TransactionStatus.SUCCESS,
      });

      const message = createMessage();
      await consumer['handleWebhook'](message);

      expect(webhookService.send).toHaveBeenCalledWith(
        message.webhookUrl,
        message.payload,
        message.webhookSecret,
        message.transactionId,
      );
      expect(transactionService.updateStatus).toHaveBeenCalledWith({
        transactionId: 'mock-txn-id',
        status: TransactionStatus.SUCCESS,
        details: {
          httpStatus: 200,
          responseBody: '{"status":"ok"}',
          webhookPayload: message.payload,
        },
      });
    });

    it('should update transaction to FAILED when all retries exhausted', async () => {
      webhookService.send.mockResolvedValue({ success: false });
      transactionService.updateStatus.mockResolvedValue({
        id: 'mock-txn-id',
        status: TransactionStatus.FAILED,
      });

      const message = createMessage();
      await consumer['handleWebhook'](message);

      expect(transactionService.updateStatus).toHaveBeenCalledWith({
        transactionId: 'mock-txn-id',
        status: TransactionStatus.FAILED,
        errorCode: 'WEBHOOK_FAILED',
        errorMessage: 'HST did not respond after max retries',
        details: {
          webhookPayload: message.payload,
        },
      });
    });

    it('should update transaction to FAILED on system errors', async () => {
      const systemError = new Error('Connection refused');
      webhookService.send.mockRejectedValue(systemError);
      transactionService.updateStatus.mockResolvedValue({
        id: 'mock-txn-id',
        status: TransactionStatus.FAILED,
      });

      const message = createMessage();

      await expect(consumer['handleWebhook'](message)).rejects.toThrow(
        'Connection refused',
      );

      expect(transactionService.updateStatus).toHaveBeenCalledWith({
        transactionId: 'mock-txn-id',
        status: TransactionStatus.FAILED,
        errorCode: 'SYSTEM_ERROR',
        errorMessage: 'Connection refused',
      });
    });

    it('should pass correct parameters to webhookService.send', async () => {
      webhookService.send.mockResolvedValue({
        success: true,
        httpStatus: 200,
        responseBody: '{"status":"ok"}',
      });
      transactionService.updateStatus.mockResolvedValue({
        id: 'mock-txn-id',
        status: TransactionStatus.SUCCESS,
      });

      const message = createMessage({
        webhookUrl: 'https://hst.example.com/callback',
        webhookSecret: 'hst-secret-xyz',
        transactionId: 'txn-999',
      });
      await consumer['handleWebhook'](message);

      expect(webhookService.send).toHaveBeenCalledWith(
        'https://hst.example.com/callback',
        message.payload,
        'hst-secret-xyz',
        'txn-999',
      );
    });

    it('should handle unknown error message gracefully', async () => {
      // Using a non-Error object to simulate unknown error format
      const unknownError = Object.assign(new Error('ERR_UNKNOWN'), {
        code: 'ERR_UNKNOWN',
      });
      webhookService.send.mockRejectedValue(unknownError);
      transactionService.updateStatus.mockResolvedValue({
        id: 'mock-txn-id',
        status: TransactionStatus.FAILED,
      });

      const message = createMessage();

      await expect(consumer['handleWebhook'](message)).rejects.toThrow(
        'ERR_UNKNOWN',
      );

      expect(transactionService.updateStatus).toHaveBeenCalledWith({
        transactionId: 'mock-txn-id',
        status: TransactionStatus.FAILED,
        errorCode: 'SYSTEM_ERROR',
        errorMessage: 'ERR_UNKNOWN',
      });
    });
  });

  describe('onModuleInit', () => {
    it('should wait for RabbitMQ (no auto consumer start)', async () => {
      // Mock application.findMany to return empty array so no consumers start
      prismaService.application.findMany.mockResolvedValue([]);

      await consumer.onModuleInit();

      expect(amqpService.isReady).toHaveBeenCalled();
      // Consumers start on-demand, not at startup
      expect(amqpService.consumeWebhook).not.toHaveBeenCalled();
    });

    it('should start consumer when startConsumerForProcessor is called', async () => {
      await consumer.startConsumerForProcessor('WRP001');

      // Should ensure queues exist first
      expect(amqpService.ensureAllQueuesForProcessor).toHaveBeenCalledWith(
        'WRP001',
        'check-in',
      );
      expect(amqpService.consumeWebhook).toHaveBeenCalledWith(
        expect.any(Function),
        'WRP001',
      );
    });

    it('should throw error when RabbitMQ connection times out', async () => {
      amqpService.isReady.mockReturnValue(false);

      // Create a new consumer instance with short timeout for testing
      const shortTimeoutConsumer = new WebhookConsumer(
        amqpService as unknown as import('../../src/infrastructure/messaging/amqp.service').AmqpService,
        transactionService as unknown as import('../../src/modules/transaction/transaction.service').TransactionService,
        webhookService as unknown as import('../../src/modules/webhook/webhook.service').WebhookService,
        prismaService as unknown as import('../../src/infrastructure/database/prisma.service').PrismaService,
        mockAppLogger as unknown as import('../../src/common/logger/logger.service').AppLogger,
      );

      // Override waitForRabbitMQ to use shorter timeout
      jest
        .spyOn(shortTimeoutConsumer as any, 'waitForRabbitMQ')
        .mockImplementation(async (_maxWaitMs = 30000) => {
          const start = Date.now();
          while (!(amqpService.isReady as jest.Mock)()) {
            if (Date.now() - start > 100) {
              // Use 100ms for test
              throw new Error('RabbitMQ connection timeout');
            }
            await new Promise((resolve) => setTimeout(resolve, 10));
          }
        });

      await expect(shortTimeoutConsumer.onModuleInit()).rejects.toThrow(
        'RabbitMQ connection timeout',
      );
    }, 10000);
  });
});
