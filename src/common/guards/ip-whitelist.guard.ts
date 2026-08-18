import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AppLogger } from '../logger/logger.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

interface ApplicationContext {
  code?: string;
  allowedIps?: string[];
}

interface RequestWithApplication extends Request {
  application?: ApplicationContext;
}

@Injectable()
export class IpWhitelistGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly logger: AppLogger,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithApplication>();
    const application = request.application;

    if (!application) {
      throw new ForbiddenException('Application context not found');
    }

    const clientIp = this.getClientIp(request);
    const allowedIps: string[] = application.allowedIps || [];

    // DENY ALL if no IPs configured
    if (allowedIps.length === 0) {
      this.logger.warn(
        `IP whitelist denied - no IPs configured for application: ${application.code}`,
        'IpWhitelistGuard',
      );
      throw new ForbiddenException(
        'IP address not configured for this application',
      );
    }

    // Check if client IP is in whitelist
    const isIpAllowed = this.isIpAllowed(clientIp, allowedIps);

    if (!isIpAllowed) {
      this.logger.warn(
        `IP whitelist denied - client IP not in whitelist: ${clientIp}`,
        'IpWhitelistGuard',
      );
      throw new ForbiddenException('IP address not allowed');
    }

    this.logger.log(
      `IP whitelist allowed - client IP authorized: ${clientIp}`,
      'IpWhitelistGuard',
    );

    return true;
  }

  private getClientIp(request: Request): string {
    // Trust first proxy - get from X-Forwarded-For header
    const forwardedFor = request.headers['x-forwarded-for'];
    if (forwardedFor) {
      const ips = Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : forwardedFor.split(',')[0];
      const clientIp = ips.trim();
      return clientIp;
    }

    // Fallback to req.ip
    const clientIp = request.ip || request.socket?.remoteAddress || 'unknown';
    return clientIp;
  }

  private isIpAllowed(clientIp: string, allowedIps: string[]): boolean {
    const normalizedClientIp = this.normalizeIp(clientIp);
    const normalizedAllowedIps = allowedIps.map((ip) => this.normalizeIp(ip));

    return normalizedAllowedIps.includes(normalizedClientIp);
  }

  private normalizeIp(ip: string): string {
    if (ip.startsWith('::ffff:')) {
      return ip.substring(7);
    }
    return ip;
  }
}
