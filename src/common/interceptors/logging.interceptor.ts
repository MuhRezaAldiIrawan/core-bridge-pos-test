import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { Request, Response } from 'express';
import { AppLogger } from '../logger/logger.service';
import { CORRELATION_ID_HEADER } from '../decorators/correlation-id.decorator';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: AppLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const startTime = Date.now();
    const correlationId =
      (request.headers[CORRELATION_ID_HEADER] as string) || uuidv4();

    request.correlationId = correlationId;
    response.setHeader(CORRELATION_ID_HEADER, correlationId);

    const { method, url } = request;

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          this.logger.logWithCorrelationId(
            `${method} ${url} ${response.statusCode} - ${duration}ms`,
            correlationId,
          );
        },
        error: (_error: Error) => {
          const duration = Date.now() - startTime;
          this.logger.logWithCorrelationId(
            `${method} ${url} ERROR - ${duration}ms`,
            correlationId,
          );
        },
      }),
    );
  }
}
