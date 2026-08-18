import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { CheckinService } from '../../../../src/modules/checkin/checkin.service';
import { TransactionService } from '../../../../src/modules/transaction/transaction.service';
import { AmqpService } from '../../../../src/infrastructure/messaging/amqp.service';
import { AppLogger } from '../../../../src/common/logger/logger.service';
import {
  mockAppLogger,
  createMockAmqpService,
  MockAmqpService,
} from '../../jest-setup';

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-1234'),
}));

const mockRequestDto = {
  member_uid: 'MBR001',
  member_name: 'Budi Santoso',
  image_url: 'https://example.com/photo.jpg',
  phone_number: '081234567890',
  email: 'budi@example.com',
  venue_id: '2',
  site_code: 'JKT',
  access_level_uid: 'LVL001',
  product_id: 2,
  product_name: '3 day pass',
  product_type: 'membership',
  webhook_url: 'https://hst-backend.example.com/webhook',
  processor_code: 'HST',
};

describe('CheckinService', () => {
  let service: CheckinService;
  let transactionService: jest.Mocked<TransactionService>;
  let amqpService: MockAmqpService;

  const mockTransaction = {
    id: 'mock-uuid-1234',
    type: 'CHECK_IN',
    status: 'PENDING',
    applicationId: 'app-123',
    processorCode: 'WRP001',
    webhookUrl: mockRequestDto.webhook_url,
    venueId: mockRequestDto.venue_id,
    params: mockRequestDto,
    errorCode: null,
    errorMessage: null,
    retryCount: 0,
    processorApplicationId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockTransactionService = {
      create: jest.fn(),
      updateStatus: jest.fn(),
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckinService,
        { provide: TransactionService, useValue: mockTransactionService },
        { provide: AmqpService, useFactory: createMockAmqpService },
        { provide: AppLogger, useValue: mockAppLogger },
      ],
    }).compile();

    service = module.get<CheckinService>(CheckinService);
    transactionService = module.get(TransactionService);
    amqpService = module.get(AmqpService);
  });

  describe('createCheckin', () => {
    it('should create transaction and publish to queue', async () => {
      transactionService.create.mockResolvedValue({
        transaction: mockTransaction,
        correlationId: 'mock-uuid-1234',
      });
      transactionService.updateStatus.mockResolvedValue({
        ...mockTransaction,
        status: 'PUBLISHED',
      });

      const result = await service.createCheckin(
        mockRequestDto,
        'app-123',
        'HST',
      );

      expect(result.status).toBe('ACCEPTED');
      expect(result.transaction_type).toBe('CREATE_ACCESS');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(transactionService.create).toHaveBeenCalledWith({
        type: 'CHECK_IN',
        correlationId: 'mock-uuid-1234',
        processorCode: mockRequestDto.processor_code,
        payload: mockRequestDto,
        webhookUrl: mockRequestDto.webhook_url,
        applicationId: 'app-123',
        venueId: mockRequestDto.venue_id,
      });
      expect(amqpService.publishAccessRequest).toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(transactionService.updateStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          transactionId: mockTransaction.id,
          status: 'PUBLISHED',
          details: expect.objectContaining({
            transaction_id: mockTransaction.id,
            member_uid: 'MBR001',
            publishedAt: expect.any(String),
          }),
        }),
      );
    });

    it('should throw ServiceUnavailableException when RabbitMQ not ready', async () => {
      amqpService.isReady.mockReturnValue(false);

      await expect(
        service.createCheckin(mockRequestDto, 'app-123', 'HST'),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('should throw error when transaction creation fails', async () => {
      transactionService.create.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(
        service.createCheckin(mockRequestDto, 'app-123', 'HST'),
      ).rejects.toThrow('Database connection failed');
    });
  });
});
