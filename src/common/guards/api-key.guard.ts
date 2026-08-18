import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AppLogger } from '../logger/logger.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { APPLICATION_KEY } from '../decorators/current-application.decorator';
import { ApplicationService } from '../../modules/application/application.service';

export interface ApplicationContext {
  id: string;
  code: string;
  name: string;
  type: string;
  allowedIps: string[];
}

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly logger: AppLogger,
    private readonly applicationService: ApplicationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = this.extractApiKey(request);

    if (!apiKey) {
      this.logger.warn('Missing API Key in request', 'ApiKeyGuard');
      throw new UnauthorizedException('Missing API key');
    }

    const application = await this.applicationService.findByApiKey(apiKey);

    if (!application) {
      this.logger.warn(
        `Invalid API Key attempted: ${apiKey.substring(0, 8)}...`,
        'ApiKeyGuard',
      );
      throw new UnauthorizedException('Invalid API key');
    }

    const allowedIps = Array.isArray(application.allowedIps)
      ? (application.allowedIps as string[])
      : [];

    const applicationContext: ApplicationContext = {
      id: application.id,
      code: application.code,
      name: application.name,
      type: application.type,
      allowedIps,
    };
    request[APPLICATION_KEY] = applicationContext;

    this.logger.logWithCorrelationId(
      `Authenticated application: ${application.code}`,
      request.correlationId || 'unknown',
      { applicationCode: application.code },
    );

    return true;
  }

  private extractApiKey(request: Request): string | undefined {
    const apiKey = request.headers['x-api-key'] as string;
    if (apiKey) return apiKey;

    const authHeader = request.headers.authorization;
    if (authHeader?.toLowerCase().startsWith('apikey ')) {
      return authHeader.substring(7);
    }

    return request.query.apiKey as string;
  }
}
