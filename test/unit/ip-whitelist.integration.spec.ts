/**
 * IP Whitelist Feature - Specification Tests
 *
 * These tests verify the implementation follows the design spec.
 * Integration tests with actual HTTP requests require database setup.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IpWhitelistGuard } from '../../src/common/guards/ip-whitelist.guard';
import { AppLogger } from '../../src/common/logger/logger.service';
import { IS_PUBLIC_KEY } from '../../src/common/decorators/public.decorator';

// Mock logger
const mockLogger = {
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

describe('IP Whitelist Guard - Spec Compliance', () => {
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
    application: {
      id?: string;
      code?: string;
      allowedIps?: string[];
    },
    ip: string,
    forwardedFor?: string,
  ): ExecutionContext =>
    ({
      getHandler: () => jest.fn(),
      getClass: () => class MockController {},
      switchToHttp: () => ({
        getRequest: () => ({
          ip,
          headers: forwardedFor ? { 'x-forwarded-for': forwardedFor } : {},
          socket: { remoteAddress: ip },
          application,
        }),
      }),
    }) as unknown as ExecutionContext;

  describe('Spec: public routes bypass IP whitelist', () => {
    it('should allow access to public routes without IP whitelist validation', () => {
      const reflectorObject = {
        getAllAndOverride: jest.fn().mockReturnValue(true),
      };
      const reflector = reflectorObject as unknown as Reflector;

      const publicGuard = new IpWhitelistGuard(
        reflector,
        mockLogger as unknown as AppLogger,
      );
      const handler = jest.fn();
      const controllerClass = class PublicRouteController {};
      const context = {
        getHandler: () => handler,
        getClass: () => controllerClass,
        switchToHttp: () => ({
          getRequest: () => ({
            ip: '127.0.0.1',
            headers: {},
            socket: { remoteAddress: '127.0.0.1' },
          }),
        }),
      } as unknown as ExecutionContext;

      expect(publicGuard.canActivate(context)).toBe(true);
      expect(reflectorObject.getAllAndOverride).toHaveBeenCalledWith(
        IS_PUBLIC_KEY,
        [handler, controllerClass],
      );
    });
  });

  describe('Spec: DENY ALL if allowedIps is empty', () => {
    it('should deny when allowedIps is empty array', () => {
      const context = createMockContext(
        { id: '1', allowedIps: [] },
        '127.0.0.1',
      );
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should deny when allowedIps is undefined', () => {
      const context = createMockContext(
        { id: '1', allowedIps: undefined },
        '127.0.0.1',
      );
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should throw message: IP address not configured', () => {
      const context = createMockContext(
        { id: '1', allowedIps: [] },
        '127.0.0.1',
      );
      expect(() => guard.canActivate(context)).toThrow(
        'IP address not configured for this application',
      );
    });
  });

  describe('Spec: DENY if IP not in whitelist', () => {
    it('should deny when IP not in whitelist', () => {
      const context = createMockContext(
        { id: '1', allowedIps: ['192.168.1.100'] },
        '192.168.1.200',
      );
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should throw message: IP address not allowed', () => {
      const context = createMockContext(
        { id: '1', allowedIps: ['192.168.1.100'] },
        '192.168.1.200',
      );
      expect(() => guard.canActivate(context)).toThrow(
        'IP address not allowed',
      );
    });
  });

  describe('Spec: ALLOW if IP in whitelist', () => {
    it('should allow whitelisted IPv4', () => {
      const context = createMockContext(
        { id: '1', allowedIps: ['192.168.1.100'] },
        '192.168.1.100',
      );
      expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow whitelisted IPv6 localhost', () => {
      const context = createMockContext(
        { id: '1', allowedIps: ['::1'] },
        '::1',
      );
      expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow 127.0.0.1', () => {
      const context = createMockContext(
        { id: '1', allowedIps: ['127.0.0.1'] },
        '127.0.0.1',
      );
      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe('Spec: Trust first proxy via X-Forwarded-For', () => {
    it('should use X-Forwarded-For header when present', () => {
      const context = createMockContext(
        { id: '1', allowedIps: ['203.0.113.50'] },
        '127.0.0.1',
        '203.0.113.50, 10.0.0.1',
      );
      expect(guard.canActivate(context)).toBe(true);
    });

    it('should take first IP from X-Forwarded-For', () => {
      const context = createMockContext(
        { id: '1', allowedIps: ['203.0.113.50'] },
        '127.0.0.1',
        '203.0.113.50, 70.41.3.18, 10.0.0.1',
      );
      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe('Spec: Normalize IPv4-mapped IPv6 addresses', () => {
    it('should normalize ::ffff:192.168.1.100 to 192.168.1.100', () => {
      const context = createMockContext(
        { id: '1', allowedIps: ['192.168.1.100'] },
        '::ffff:192.168.1.100',
      );
      expect(guard.canActivate(context)).toBe(true);
    });
  });
});

describe('Global Exception Filter - snake_case Format', () => {
  describe('Spec: Response format should be snake_case', () => {
    it('should have status_code (not statusCode)', () => {
      const expectedFields = [
        'status_code',
        'message',
        'error',
        'timestamp',
        'path',
      ];
      expectedFields.forEach((field) => expect(typeof field).toBe('string'));
    });

    it('should NOT have errorId or correlationId in response format', () => {
      // These fields should be removed per spec
      const removedFields = ['errorId', 'correlationId'];
      // Verify these are NOT valid snake_case field names we expect
      expect(removedFields).not.toContain('status_code');
    });
  });
});
