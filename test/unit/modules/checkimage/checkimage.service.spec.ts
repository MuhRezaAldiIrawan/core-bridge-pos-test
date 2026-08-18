import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { CheckimageService } from '../../../../src/modules/checkimage/checkimage.service';
import { TransactionService } from '../../../../src/modules/transaction/transaction.service';
import { AmqpService } from '../../../../src/infrastructure/messaging/amqp.service';
import { AppLogger } from '../../../../src/common/logger/logger.service';
import {
  mockAppLogger,
  createMockAmqpService,
  createMockTransactionService,
  MockAmqpService,
  MockTransactionService,
} from '../../jest-setup';

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-5678'),
}));

const mockRequestDto = {
  member_uid: 'MBR001',
  member_name: 'Budi Santoso',
  image_url: 'https://example.com/new-photo.jpg',
  webhook_url: 'https://hst-backend.example.com/webhook',
  processor_code: 'HST',
};

const mockTransaction = {
  id: 'mock-txn-id',
  type: 'CHECK_IMAGE',
  status: 'PUBLISHED',
  applicationId: 'app-123',
  processorCode: 'WRP001',
  webhookUrl: mockRequestDto.webhook_url,
  venueId: 'N/A',
  params: mockRequestDto,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('CheckimageService', () => {
  let service: CheckimageService;
  let transactionService: MockTransactionService;
  let amqpService: MockAmqpService;

  beforeEach(async () => {
    transactionService = createMockTransactionService();
    amqpService = createMockAmqpService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckimageService,
        { provide: TransactionService, useValue: transactionService },
        { provide: AmqpService, useValue: amqpService },
        { provide: AppLogger, useValue: mockAppLogger },
      ],
    }).compile();

    service = module.get<CheckimageService>(CheckimageService);

    // Reset mock to return proper transaction
    transactionService.create.mockResolvedValue({
      transaction: { ...mockTransaction, status: 'PENDING' },
      correlationId: 'mock-txn-id',
    });
  });

  describe('createCheckimage', () => {
    it('should create checkimage transaction and publish to queue', async () => {
      const result = await service.createCheckimage(mockRequestDto, 'app-123');

      expect(result.status).toBe('ACCEPTED');
      expect(result.transaction_type).toBe('CHECK_IMAGE');
      expect(result.transaction_id).toBe('mock-txn-id');
      expect(amqpService.publishCheckimageRequest).toHaveBeenCalled();
    });

    it('should use TransactionService.create for transaction creation', async () => {
      await service.createCheckimage(mockRequestDto, 'app-123');

      expect(transactionService.create).toHaveBeenCalledWith({
        type: 'CHECK_IMAGE',
        correlationId: 'mock-uuid-5678',
        processorCode: mockRequestDto.processor_code,
        payload: mockRequestDto,
        webhookUrl: mockRequestDto.webhook_url,
        applicationId: 'app-123',
        venueId: 'N/A',
      });
    });

    it('should publish with transaction.id as correlationId', async () => {
      await service.createCheckimage(mockRequestDto, 'app-123');

      expect(amqpService.publishCheckimageRequest).toHaveBeenCalledWith(
        'HST',
        expect.objectContaining({
          transaction_id: 'mock-txn-id',
          member_uid: 'MBR001',
          image_url: 'https://example.com/new-photo.jpg',
        }),
        'mock-txn-id',
      );
    });

    it('should update status to PUBLISHED after successful publish', async () => {
      await service.createCheckimage(mockRequestDto, 'app-123');

      expect(transactionService.updateStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          transactionId: 'mock-txn-id',
          status: 'PUBLISHED',
          details: expect.objectContaining({
            transaction_id: 'mock-txn-id',
            member_uid: 'MBR001',
            publishedAt: expect.any(String),
          }),
        }),
      );
    });

    it('should throw ServiceUnavailableException when RabbitMQ not ready', async () => {
      amqpService.isReady.mockReturnValue(false);

      await expect(
        service.createCheckimage(mockRequestDto, 'app-123'),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('should throw error when TransactionService fails', async () => {
      transactionService.create.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(
        service.createCheckimage(mockRequestDto, 'app-123'),
      ).rejects.toThrow('Database connection failed');
    });

    it('should create checkimage successfully', async () => {
      const result = await service.createCheckimage(mockRequestDto, 'app-123');

      expect(result.status).toBe('ACCEPTED');
      expect(result.transaction_id).toBe('mock-txn-id');
    });
  });
});
