import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { IpWhitelistGuard } from '../../../../src/common/guards/ip-whitelist.guard';
import { AppLogger } from '../../../../src/common/logger/logger.service';

// Mock logger
const mockLogger = {
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

describe('IpWhitelistGuard', () => {
  let guard: IpWhitelistGuard;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IpWhitelistGuard,
        { provide: AppLogger, useValue: mockLogger },
      ],
    }).compile();

    guard = module.get<IpWhitelistGuard>(IpWhitelistGuard);
  });

  const createMockContext = (
    application: any,
    ip: string,
    forwardedFor?: string,
  ) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          ip,
          headers: forwardedFor ? { 'x-forwarded-for': forwardedFor } : {},
          socket: { remoteAddress: ip },
          application,
        }),
      }),
    }) as ExecutionContext;

  describe('canActivate', () => {
    it('should allow request when IP is in whitelist', () => {
      const application = {
        id: '1',
        code: 'HST001',
        allowedIps: ['192.168.1.100', '10.0.0.1'],
      };
      const context = createMockContext(application, '192.168.1.100');

      const result = guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should deny request when IP is NOT in whitelist', () => {
      const application = {
        id: '1',
        code: 'HST001',
        allowedIps: ['192.168.1.100'],
      };
      const context = createMockContext(application, '192.168.1.200');

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should deny request when allowedIps is empty array', () => {
      const application = { id: '1', code: 'HST001', allowedIps: [] };
      const context = createMockContext(application, '127.0.0.1');

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should deny request when allowedIps is undefined', () => {
      const application = {
        id: '1',
        code: 'HST001',
        allowedIps: undefined as any,
      };
      const context = createMockContext(application, '127.0.0.1');

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should allow ::1 (IPv6 localhost) when in whitelist', () => {
      const application = { id: '1', code: 'HST001', allowedIps: ['::1'] };
      const context = createMockContext(application, '::1');

      const result = guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should allow 127.0.0.1 when in whitelist', () => {
      const application = {
        id: '1',
        code: 'HST001',
        allowedIps: ['127.0.0.1'],
      };
      const context = createMockContext(application, '127.0.0.1');

      const result = guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should use X-Forwarded-For header when present', () => {
      const application = {
        id: '1',
        code: 'HST001',
        allowedIps: ['203.0.113.50'],
      };
      const context = createMockContext(
        application,
        '127.0.0.1',
        '203.0.113.50, 70.41.3.18',
      );

      const result = guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should normalize IPv4-mapped IPv6 addresses', () => {
      const application = {
        id: '1',
        code: 'HST001',
        allowedIps: ['192.168.1.100'],
      };
      const context = createMockContext(application, '::ffff:192.168.1.100');

      const result = guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should throw ForbiddenException with correct message for IP not allowed', () => {
      const application = {
        id: '1',
        code: 'HST001',
        allowedIps: ['192.168.1.100'],
      };
      const context = createMockContext(application, '192.168.1.200');

      expect(() => guard.canActivate(context)).toThrow(
        'IP address not allowed',
      );
    });

    it('should throw ForbiddenException with correct message for empty IP list', () => {
      const application = { id: '1', code: 'HST001', allowedIps: [] };
      const context = createMockContext(application, '127.0.0.1');

      expect(() => guard.canActivate(context)).toThrow(
        'IP address not configured for this application',
      );
    });
  });
});
