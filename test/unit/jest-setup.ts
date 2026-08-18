import { jest } from '@jest/globals';
import { Mock } from 'jest-mock';

// Transaction types
interface TransactionCreateResult {
  id: string;
  type: string;
  status: string;
  applicationId: string;
  processorCode: string;
  webhookUrl: string;
  venueId: string;
  params: Record<string, any>;
  errorCode: string | null;
  errorMessage: string | null;
  retryCount: number;
  processorApplicationId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface TransactionLogCreateResult {
  id: string;
  transactionId: string;
  status: string;
  action: string;
  details: Record<string, any>;
  createdAt: Date;
}

interface WebhookLogCreateResult {
  id: string;
  transactionId: string;
  attemptNumber: number;
  httpStatus: number | null;
  responseBody: string | null;
  errorMessage: string | null;
  success: boolean;
}

// Mock functions with explicit types
function createMockFn<T extends (...args: any[]) => any>(): Mock<T> {
  return jest.fn();
}

export const mockAppLogger = {
  log: createMockFn<(message: string, context?: string) => void>(),
  error:
    createMockFn<(message: string, trace?: string, context?: string) => void>(),
  warn: createMockFn<(message: string, context?: string) => void>(),
  debug: createMockFn<(message: string, context?: string) => void>(),
  verbose: createMockFn<(message: string, context?: string) => void>(),
  logWithCorrelationId:
    createMockFn<
      (
        message: string,
        correlationId: string,
        data?: Record<string, any>,
      ) => void
    >(),
};

export interface MockPrismaService {
  transaction: {
    create: Mock<() => Promise<TransactionCreateResult>>;
    update: Mock<() => Promise<TransactionCreateResult>>;
    findUnique: Mock<() => Promise<TransactionCreateResult | null>>;
    findFirst: Mock<() => Promise<TransactionCreateResult | null>>;
  };
  application: {
    findUnique: Mock<() => Promise<{ id: string; code: string } | null>>;
    findMany: Mock<() => Promise<{ code: string }[]>>;
  };
  transactionLog: {
    create: Mock<() => Promise<TransactionLogCreateResult>>;
    findFirst: Mock<() => Promise<unknown>>;
  };
  webhookLog: {
    create: Mock<() => Promise<WebhookLogCreateResult>>;
  };
  $transaction: any;
  $queryRaw: Mock<() => Promise<unknown>>;
}

export const createMockPrismaService = (): MockPrismaService => ({
  transaction: {
    create: createMockFn<() => Promise<TransactionCreateResult>>(),
    update: createMockFn<() => Promise<TransactionCreateResult>>(),
    findUnique: createMockFn<() => Promise<TransactionCreateResult | null>>(),
    findFirst: createMockFn<() => Promise<TransactionCreateResult | null>>(),
  },
  application: {
    findUnique: createMockFn<
      () => Promise<{ id: string; code: string } | null>
    >().mockResolvedValue({
      id: 'processor-app-id',
      code: 'WRP001',
    }),
    findMany: createMockFn<
      () => Promise<{ code: string }[]>
    >().mockResolvedValue([{ code: 'WRP001' }]),
  },
  transactionLog: {
    create: createMockFn<() => Promise<TransactionLogCreateResult>>(),
    findFirst: createMockFn<() => Promise<unknown>>(),
  },
  webhookLog: {
    create: createMockFn<() => Promise<WebhookLogCreateResult>>(),
  },
  $transaction: jest.fn(),
  $queryRaw: createMockFn<() => Promise<unknown>>(),
});

export interface MockCacheService {
  get: Mock<() => Promise<any>>;
  set: Mock<() => Promise<void>>;
  del: Mock<() => Promise<void>>;
  getOrSet: Mock<() => Promise<any>>;
  isReady: Mock<() => boolean>;
}

export const createMockCacheService = (): MockCacheService => ({
  get: createMockFn<() => Promise<any>>(),
  set: createMockFn<() => Promise<void>>(),
  del: createMockFn<() => Promise<void>>(),
  getOrSet: createMockFn<() => Promise<any>>(),
  isReady: createMockFn<() => boolean>().mockReturnValue(true),
});

export interface MockAmqpService {
  connection: unknown;
  channelWrapper: unknown;
  config: unknown;
  isConnected: boolean;
  configService: unknown;
  logger: unknown;
  isReady: Mock<() => boolean>;
  publishAccessRequest: Mock<() => Promise<string>>;
  publishCheckimageRequest: Mock<() => Promise<string>>;
  publishWebhook: Mock<() => Promise<void>>;
  consumeAccessResponse: Mock<() => Promise<void>>;
  consumeCheckimageResponse: Mock<() => Promise<void>>;
  consumeWebhook: Mock<() => Promise<void>>;
  ensureAllQueuesForProcessor: Mock<() => Promise<void>>;
  onModuleInit: Mock<() => Promise<void>>;
  onModuleDestroy: Mock<() => Promise<void>>;
  [key: string]: unknown;
}

export const createMockAmqpService = (): MockAmqpService => ({
  connection: {},
  channelWrapper: {},
  config: {},
  isConnected: true,
  configService: {},
  logger: {},
  isReady: createMockFn<() => boolean>().mockReturnValue(true),
  publishAccessRequest: createMockFn<() => Promise<string>>().mockResolvedValue(
    'mock-correlation-id',
  ),
  publishCheckimageRequest: createMockFn<
    () => Promise<string>
  >().mockResolvedValue('mock-correlation-id'),
  publishWebhook:
    createMockFn<() => Promise<void>>().mockResolvedValue(undefined),
  consumeAccessResponse: createMockFn<() => Promise<void>>(),
  consumeCheckimageResponse: createMockFn<() => Promise<void>>(),
  consumeWebhook: createMockFn<() => Promise<void>>(),
  ensureAllQueuesForProcessor:
    createMockFn<() => Promise<void>>().mockResolvedValue(undefined),
  onModuleInit:
    createMockFn<() => Promise<void>>().mockResolvedValue(undefined),
  onModuleDestroy:
    createMockFn<() => Promise<void>>().mockResolvedValue(undefined),
});

export const createMockConfigService = () => ({
  get: createMockFn<(key: string, defaultValue?: unknown) => unknown>(),
});

export interface MockTransactionService {
  create: Mock<() => Promise<{ transaction: any; correlationId: string }>>;
  updateStatus: Mock<() => Promise<any>>;
  findById: Mock<() => Promise<any>>;
  findByTransactionId: Mock<() => Promise<any>>;
  update: Mock<() => Promise<any>>;
  markWebhookSent: Mock<() => Promise<any>>;
  updateStatusWithDetails: Mock<() => Promise<any>>;
  prisma: unknown;
  cache: unknown;
  logger: unknown;
  [key: string]: unknown;
}

export interface MockWebhookService {
  send: Mock<
    () => Promise<{
      success: boolean;
      httpStatus?: number;
      responseBody?: string;
    }>
  >;
  [key: string]: unknown;
}

export const createMockTransactionService = (): MockTransactionService => ({
  create: createMockFn<
    () => Promise<{ transaction: any; correlationId: string }>
  >().mockResolvedValue({
    transaction: {
      id: 'mock-txn-id',
      type: 'CHECK_IMAGE',
      status: 'PENDING',
      applicationId: 'app-123',
      processorCode: 'WRP001',
      webhookUrl: 'https://example.com/webhook',
      venueId: 'N/A',
      params: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    correlationId: 'mock-corr-id',
  }),
  updateStatus: createMockFn<() => Promise<any>>().mockResolvedValue({
    id: 'mock-txn-id',
    status: 'PUBLISHED',
  }),
  findById: createMockFn<() => Promise<any>>(),
  findByTransactionId: createMockFn<() => Promise<any>>(),
  update: createMockFn<() => Promise<any>>(),
  markWebhookSent: createMockFn<() => Promise<any>>(),
  updateStatusWithDetails: createMockFn<() => Promise<any>>(),
  prisma: {},
  cache: {},
  logger: {},
});

export const createMockWebhookService = (): MockWebhookService => ({
  send: createMockFn<
    () => Promise<{
      success: boolean;
      httpStatus?: number;
      responseBody?: string;
    }>
  >().mockResolvedValue({
    success: true,
    httpStatus: 200,
    responseBody: '{"status":"ok"}',
  }),
});

beforeEach(() => {
  jest.clearAllMocks();
});
