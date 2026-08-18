import { Test, TestingModule } from '@nestjs/testing';
import { TransactionService } from '../../../../src/modules/transaction/transaction.service';
import { PrismaService } from '../../../../src/infrastructure/database/prisma.service';
import { CacheService } from '../../../../src/infrastructure/cache/cache.service';
import { AppLogger } from '../../../../src/common/logger/logger.service';
import { TransactionStatus } from '../../../../src/modules/transaction/dto/update-status.dto';
import {
  mockAppLogger,
  createMockPrismaService,
  createMockCacheService,
  MockPrismaService,
  MockCacheService,
} from '../../jest-setup';

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-1234'),
}));

describe('TransactionService', () => {
  let service: TransactionService;
  let prismaService: MockPrismaService;
  let cacheService: MockCacheService;

  const mockTransaction = {
    id: 'mock-uuid-1234',
    type: 'CHECK_IN',
    applicationId: 'app-123',
    processorCode: 'WRP001',
    webhookUrl: 'https://example.com/webhook',
    venueId: 'venue-1',
    status: 'PENDING',
    errorCode: null,
    errorMessage: null,
    params: { member_uid: 'MBR001' },
    retryCount: 0,
    processorApplicationId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prismaService = createMockPrismaService();
    cacheService = createMockCacheService();

    prismaService.transaction.create.mockResolvedValue(mockTransaction);
    prismaService.transaction.update.mockResolvedValue({
      ...mockTransaction,
      status: 'SUCCESS',
    });
    prismaService.transaction.findUnique.mockResolvedValue(mockTransaction);
    prismaService.transactionLog.create.mockResolvedValue({
      id: 'log-1',
      transactionId: 'mock-uuid-1234',
      status: 'PENDING',
      action: 'CREATE_TRANSACTION',
      details: {},
      createdAt: new Date(),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionService,
        { provide: PrismaService, useValue: prismaService },
        { provide: CacheService, useValue: cacheService },
        { provide: AppLogger, useValue: mockAppLogger },
      ],
    }).compile();

    service = module.get<TransactionService>(TransactionService);
  });

  describe('create', () => {
    it('should create a transaction with PENDING status', async () => {
      const dto = {
        type: 'CHECK_IN' as const,
        correlationId: 'corr-123',
        processorCode: 'WRP001',
        webhookUrl: 'https://example.com/webhook',
        applicationId: 'app-123',
        venueId: 'venue-1',
      };

      const result = await service.create(dto);

      expect(result.transaction).toBeDefined();
      expect(result.transaction.id).toBe('mock-uuid-1234');
      expect(result.transaction.status).toBe('PENDING');
      expect(prismaService.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: 'mock-uuid-1234',
          type: 'CHECK_IN',
          applicationId: 'app-123',
          processorCode: 'WRP001',
          webhookUrl: 'https://example.com/webhook',
          venueId: 'venue-1',
          status: 'PENDING',
        }),
      });
    });

    it('should create a transaction log entry', async () => {
      const dto = {
        type: 'CHECK_IN' as const,
        correlationId: 'corr-123',
        processorCode: 'WRP001',
        webhookUrl: 'https://example.com/webhook',
        applicationId: 'app-123',
      };

      await service.create(dto);

      expect(prismaService.transactionLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          transactionId: 'mock-uuid-1234',
          status: 'PENDING',
          action: 'CREATE_TRANSACTION',
        }),
      });
    });

    it('should return provided correlationId', async () => {
      const dto = {
        type: 'CHECK_IN' as const,
        correlationId: 'corr-456',
        processorCode: 'WRP001',
        webhookUrl: 'https://example.com/webhook',
        applicationId: 'app-123',
      };

      const result = await service.create(dto);

      expect(result.correlationId).toBe('corr-456');
    });

    it('should use provided correlationId', async () => {
      const dto = {
        type: 'CHECK_IN' as const,
        correlationId: 'custom-corr-456',
        processorCode: 'WRP001',
        webhookUrl: 'https://example.com/webhook',
        applicationId: 'app-123',
      };

      const result = await service.create(dto);

      expect(result.correlationId).toBe('custom-corr-456');
    });

    it('should log with correlationId', async () => {
      const dto = {
        type: 'CHECK_IN' as const,
        correlationId: 'corr-123',
        processorCode: 'WRP001',
        webhookUrl: 'https://example.com/webhook',
        applicationId: 'app-123',
      };

      await service.create(dto);

      expect(mockAppLogger.logWithCorrelationId).toHaveBeenCalledWith(
        'Transaction created: mock-uuid-1234',
        'corr-123',
      );
    });

    it('should default venueId to N/A if not provided', async () => {
      const dto = {
        type: 'CHECK_IN' as const,
        correlationId: 'corr-789',
        processorCode: 'WRP001',
        webhookUrl: 'https://example.com/webhook',
        applicationId: 'app-123',
      };

      await service.create(dto);

      expect(prismaService.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          venueId: 'N/A',
        }),
      });
    });
  });

  describe('updateStatus', () => {
    it('should update transaction status to SUCCESS', async () => {
      const dto = {
        transactionId: 'mock-uuid-1234',
        status: 'SUCCESS' as any,
      };

      const result = await service.updateStatus(dto);

      expect(result.status).toBe('SUCCESS');
      expect(prismaService.transaction.update).toHaveBeenCalledWith({
        where: { id: 'mock-uuid-1234' },
        data: {
          status: 'SUCCESS',
          errorCode: null,
          errorMessage: null,
        },
      });
    });

    it('should update transaction status to FAILED with error details', async () => {
      prismaService.transaction.update.mockResolvedValue({
        ...mockTransaction,
        status: 'FAILED',
        errorCode: 'ERR001',
        errorMessage: 'Test error message',
      });

      const dto = {
        transactionId: 'mock-uuid-1234',
        status: 'FAILED' as any,
        errorCode: 'ERR001',
        errorMessage: 'Test error message',
      };

      const result = await service.updateStatus(dto);

      expect(result.status).toBe('FAILED');
      expect(prismaService.transaction.update).toHaveBeenCalledWith({
        where: { id: 'mock-uuid-1234' },
        data: {
          status: 'FAILED',
          errorCode: 'ERR001',
          errorMessage: 'Test error message',
        },
      });
    });

    it('should create transaction log with MARK_SUCCESS action', async () => {
      const dto = {
        transactionId: 'mock-uuid-1234',
        status: 'SUCCESS' as any,
      };

      await service.updateStatus(dto);

      expect(prismaService.transactionLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          transactionId: 'mock-uuid-1234',
          status: 'SUCCESS',
          action: 'MARK_SUCCESS',
        }),
      });
    });

    it('should create transaction log with MARK_FAILED action', async () => {
      const dto = {
        transactionId: 'mock-uuid-1234',
        status: 'FAILED' as any,
        errorCode: 'ERR001',
        errorMessage: 'Error',
      };

      await service.updateStatus(dto);

      expect(prismaService.transactionLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          transactionId: 'mock-uuid-1234',
          status: 'FAILED',
          action: 'MARK_FAILED',
          errorCode: 'ERR001',
          errorMessage: 'Error',
        }),
      });
    });

    it('should cache final state for SUCCESS status', async () => {
      const dto = {
        transactionId: 'mock-uuid-1234',
        status: 'SUCCESS' as any,
      };

      await service.updateStatus(dto);

      expect(cacheService.set).toHaveBeenCalledWith(
        'txn:mock-uuid-1234',
        expect.objectContaining({
          id: 'mock-uuid-1234',
          status: 'SUCCESS',
        }),
        1800,
      );
    });

    it('should cache final state for FAILED status', async () => {
      const dto = {
        transactionId: 'mock-uuid-1234',
        status: 'FAILED' as any,
        errorCode: 'ERR001',
        errorMessage: 'Test error',
      };

      await service.updateStatus(dto);

      expect(cacheService.set).toHaveBeenCalledWith(
        'txn:mock-uuid-1234',
        expect.objectContaining({
          id: 'mock-uuid-1234',
          status: 'FAILED',
          errorCode: 'ERR001',
          errorMessage: 'Test error',
        }),
        1800,
      );
    });

    it('should NOT cache for PENDING status', async () => {
      const dto = {
        transactionId: 'mock-uuid-1234',
        status: 'PENDING' as any,
      };

      await service.updateStatus(dto);

      expect(cacheService.set).not.toHaveBeenCalled();
    });

    it('should NOT cache for PUBLISHED status', async () => {
      const dto = {
        transactionId: 'mock-uuid-1234',
        status: 'PUBLISHED' as any,
      };

      await service.updateStatus(dto);

      expect(cacheService.set).not.toHaveBeenCalled();
    });

    it('should log with correlationId', async () => {
      const dto = {
        transactionId: 'mock-uuid-1234',
        status: 'SUCCESS' as any,
      };

      await service.updateStatus(dto);

      expect(mockAppLogger.logWithCorrelationId).toHaveBeenCalledWith(
        'Transaction mock-uuid-1234 → SUCCESS',
        'mock-uuid-1234',
      );
    });
  });

  describe('findById', () => {
    it('should find transaction by ID', async () => {
      const result = await service.findById('mock-uuid-1234');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('mock-uuid-1234');
      expect(prismaService.transaction.findUnique).toHaveBeenCalledWith({
        where: { id: 'mock-uuid-1234' },
        include: { application: true },
      });
    });

    it('should return null when transaction not found', async () => {
      prismaService.transaction.findUnique.mockResolvedValue(null);

      const result = await service.findById('non-existent-id');

      expect(result).toBeNull();
    });

    it('should include application relation', async () => {
      await service.findById('mock-uuid-1234');

      expect(prismaService.transaction.findUnique).toHaveBeenCalledWith({
        where: { id: 'mock-uuid-1234' },
        include: { application: true },
      });
    });
  });

  describe('findByTransactionId', () => {
    it('should find transaction by transactionId', async () => {
      const result = await service.findByTransactionId('mock-uuid-1234');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('mock-uuid-1234');
      expect(prismaService.transaction.findUnique).toHaveBeenCalledWith({
        where: { id: 'mock-uuid-1234' },
        include: { application: true },
      });
    });

    it('should return null when transaction not found', async () => {
      prismaService.transaction.findUnique.mockResolvedValue(null);

      const result = await service.findByTransactionId('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('markWebhookSent', () => {
    it('should update transaction status to PROCESSING', async () => {
      const result = await service.markWebhookSent('mock-uuid-1234');

      expect(result).toBeDefined();
      expect(prismaService.transaction.update).toHaveBeenCalledWith({
        where: { id: 'mock-uuid-1234' },
        data: { status: 'PROCESSING' },
      });
    });

    it('should create SENT_WEBHOOK log entry', async () => {
      await service.markWebhookSent('mock-uuid-1234');

      expect(prismaService.transactionLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          transactionId: 'mock-uuid-1234',
          status: 'PROCESSING',
          action: 'SENT_WEBHOOK',
        }),
      });
    });

    it('should include sentAt in log details when no rawData provided', async () => {
      await service.markWebhookSent('mock-uuid-1234');

      expect(prismaService.transactionLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          details: expect.objectContaining({
            sentAt: expect.any(Date),
          }),
        }),
      });
    });

    it('should log with correlationId', async () => {
      await service.markWebhookSent('mock-uuid-1234');

      expect(mockAppLogger.logWithCorrelationId).toHaveBeenCalledWith(
        'Webhook sent for mock-uuid-1234',
        'mock-uuid-1234',
      );
    });

    it('should include rawData in log details when provided', async () => {
      const rawData = { transaction_id: 'txn-123', status: 'success' };
      await service.markWebhookSent('mock-uuid-1234', rawData);

      expect(prismaService.transactionLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          details: rawData,
        }),
      });
    });
  });

  describe('updateStatusWithDetails', () => {
    const mockWristpayResponse = {
      transaction_id: 'txn-123',
      status: 'approved',
      processed_at: '2026-08-12T10:00:00Z',
      error_code: null,
      error_message: null,
    };

    it('should update transaction to PROCESSING with raw data', async () => {
      const result = await service.updateStatusWithDetails(
        'mock-uuid-1234',
        TransactionStatus.PROCESSING,
        mockWristpayResponse,
      );

      expect(result).toBeDefined();
      expect(prismaService.transaction.update).toHaveBeenCalledWith({
        where: { id: 'mock-uuid-1234' },
        data: {
          status: 'PROCESSING',
          errorCode: null,
          errorMessage: null,
        },
      });
    });

    it('should store raw data directly in log details', async () => {
      await service.updateStatusWithDetails(
        'mock-uuid-1234',
        TransactionStatus.PROCESSING,
        mockWristpayResponse,
      );

      expect(prismaService.transactionLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          transactionId: 'mock-uuid-1234',
          status: 'PROCESSING',
          action: 'MARK_PROCESSING',
          details: mockWristpayResponse,
        }),
      });
    });

    it('should extract error fields from raw data for transaction record', async () => {
      const errorResponse = {
        transaction_id: 'txn-123',
        status: 'declined',
        processed_at: '2026-08-12T10:00:00Z',
        error_code: 'ERR001',
        error_message: 'Insufficient balance',
      };

      await service.updateStatusWithDetails(
        'mock-uuid-1234',
        TransactionStatus.PROCESSING,
        errorResponse,
      );

      expect(prismaService.transaction.update).toHaveBeenCalledWith({
        where: { id: 'mock-uuid-1234' },
        data: {
          status: 'PROCESSING',
          errorCode: 'ERR001',
          errorMessage: 'Insufficient balance',
        },
      });

      expect(prismaService.transactionLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          errorCode: 'ERR001',
          errorMessage: 'Insufficient balance',
          details: errorResponse,
        }),
      });
    });

    it('should log with raw data', async () => {
      await service.updateStatusWithDetails(
        'mock-uuid-1234',
        TransactionStatus.PROCESSING,
        mockWristpayResponse,
      );

      expect(mockAppLogger.logWithCorrelationId).toHaveBeenCalledWith(
        'Transaction mock-uuid-1234 → PROCESSING',
        'mock-uuid-1234',
      );
    });
  });
});
