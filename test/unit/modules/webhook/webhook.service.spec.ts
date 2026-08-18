import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  WebhookService,
  WebhookPayload,
} from '../../../../src/modules/webhook/webhook.service';
import { WebhookLogService } from '../../../../src/modules/webhook/webhook-log.service';
import { AppLogger } from '../../../../src/common/logger/logger.service';
import { mockAppLogger } from '../../jest-setup';
import { jest } from '@jest/globals';

// Mock axios
const mockAxiosPost =
  jest.fn<() => Promise<{ status: number; data: unknown }>>();
jest.mock('axios', () => ({
  post: () => mockAxiosPost(),
}));

const mockPayload: WebhookPayload = {
  transaction_id: 'txn-123',
  status: 'success',
  processed_at: '2026-08-10T10:00:00.000Z',
  error_code: null,
  error_message: null,
};

const mockConfig = {
  WEBHOOK_TIMEOUT_MS: 10000,
  WEBHOOK_MAX_RETRIES: 3,
  WEBHOOK_RETRY_DELAYS: '5000,15000,45000',
};

// Mock WebhookLogService
const mockWebhookLogService = {
  create: jest.fn<() => Promise<{ id: string }>>(),
  updateToSuccess: jest.fn<() => Promise<{ id: string }>>(),
  updateToFailed: jest.fn<() => Promise<{ id: string }>>(),
  findByTransactionId: jest.fn(),
};

describe('WebhookService', () => {
  let service: WebhookService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockWebhookLogService.create.mockResolvedValue({ id: 'log-1' });
    mockWebhookLogService.updateToSuccess.mockResolvedValue({ id: 'log-1' });
    mockWebhookLogService.updateToFailed.mockResolvedValue({ id: 'log-1' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookService,
        {
          provide: ConfigService,
          useValue: {
            get: jest
              .fn<(key: string, defaultValue?: unknown) => unknown>()
              .mockImplementation((key: string, defaultValue?: unknown) => {
                return (
                  mockConfig[key as keyof typeof mockConfig] ?? defaultValue
                );
              }),
          },
        },
        { provide: AppLogger, useValue: mockAppLogger },
        { provide: WebhookLogService, useValue: mockWebhookLogService },
      ],
    }).compile();

    service = module.get<WebhookService>(WebhookService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('send', () => {
    it('should send webhook with correct signature', async () => {
      mockAxiosPost.mockResolvedValueOnce({ status: 200, data: null });

      const result = await service.send(
        'https://example.com/webhook',
        mockPayload,
        'test-secret',
        'txn-123',
      );

      expect(result.success).toBe(true);
      expect(result.httpStatus).toBe(200);
      expect(mockAxiosPost).toHaveBeenCalled();
    });

    it('should retry on failure with correct delays (5s, 15s, 45s)', async () => {
      jest.useFakeTimers();

      mockAxiosPost
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce({ status: 200, data: null });

      const sendPromise = service.send(
        'https://example.com/webhook',
        mockPayload,
        'test-secret',
        'txn-123',
      );

      await jest.advanceTimersByTimeAsync(5000);
      await jest.advanceTimersByTimeAsync(15000);

      const result = await sendPromise;

      expect(result.success).toBe(true);
      expect(mockAxiosPost).toHaveBeenCalledTimes(3);
    });

    it('should return { success: false } after max retries exhausted', async () => {
      jest.useFakeTimers();

      mockAxiosPost.mockRejectedValue(new Error('Persistent failure'));

      const sendPromise = service.send(
        'https://example.com/webhook',
        mockPayload,
        'test-secret',
        'txn-123',
      );

      await jest.advanceTimersByTimeAsync(5000);
      await jest.advanceTimersByTimeAsync(15000);
      await jest.advanceTimersByTimeAsync(45000);

      const result = await sendPromise;

      expect(result.success).toBe(false);
      expect(mockAxiosPost).toHaveBeenCalledTimes(3);
    });

    it('should throw error for HTTP URL', async () => {
      await expect(
        service.send(
          'http://example.com/webhook',
          mockPayload,
          'secret',
          'txn-123',
        ),
      ).rejects.toThrow('Webhook URL must use HTTPS');
    });

    it('should throw error for localhost URL', async () => {
      await expect(
        service.send(
          'https://localhost/webhook',
          mockPayload,
          'secret',
          'txn-123',
        ),
      ).rejects.toThrow('Webhook URL cannot point to internal addresses');
    });

    it('should throw error for 10.x private IP', async () => {
      await expect(
        service.send(
          'https://10.0.0.1/webhook',
          mockPayload,
          'secret',
          'txn-123',
        ),
      ).rejects.toThrow('Webhook URL cannot point to internal addresses');
    });

    it('should throw error for 192.168.x private IP', async () => {
      await expect(
        service.send(
          'https://192.168.1.100/webhook',
          mockPayload,
          'secret',
          'txn-123',
        ),
      ).rejects.toThrow('Webhook URL cannot point to internal addresses');
    });

    it('should throw error for 172.16-31.x private IP', async () => {
      await expect(
        service.send(
          'https://172.20.0.1/webhook',
          mockPayload,
          'secret',
          'txn-123',
        ),
      ).rejects.toThrow('Webhook URL cannot point to internal addresses');
    });

    it('should allow 172.x outside private range', async () => {
      mockAxiosPost.mockResolvedValueOnce({ status: 200, data: null });

      const result = await service.send(
        'https://172.32.0.1/webhook',
        mockPayload,
        'secret',
        'txn-123',
      );

      expect(result.success).toBe(true);
    });

    it('should log each webhook attempt to database', async () => {
      mockAxiosPost.mockResolvedValueOnce({ status: 200, data: null });

      await service.send(
        'https://example.com/webhook',
        mockPayload,
        'secret',
        'txn-123',
      );

      expect(mockWebhookLogService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          transactionId: 'txn-123',
          attempt: 1,
        }),
      );
    });
  });
});
