import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppLogger } from '../logger/logger.service';

interface ErrorResponse {
  status_code: number;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = this.getStatus(exception);
    const { message, error } = this.getErrorDetails(exception);

    this.logger.error(
      typeof message === 'string' ? message : message.join(', '),
      exception instanceof Error ? exception.stack : undefined,
      'GlobalExceptionFilter',
    );

    const errorResponse: ErrorResponse = {
      status_code: status,
      message: this.sanitizeMessage(status, message),
      error: error || 'Internal Server Error',
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(status).json(errorResponse);
  }

  private getStatus(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }
    if (
      exception instanceof Error &&
      exception.message.includes('ECONNREFUSED')
    ) {
      return HttpStatus.SERVICE_UNAVAILABLE;
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private getErrorDetails(exception: unknown): {
    message: string | string[];
    error: string;
  } {
    if (exception instanceof HttpException) {
      const resp = exception.getResponse();
      if (typeof resp === 'string') {
        return { message: resp, error: exception.name };
      }
      const r = resp as Record<string, unknown>;
      return {
        message: (r.message as string | string[]) || exception.message,
        error: (r.error as string) || exception.name,
      };
    }
    if (exception instanceof Error) {
      return { message: exception.message, error: exception.name };
    }
    return { message: 'An unexpected error occurred', error: 'Error' };
  }

  private sanitizeMessage(status: number, message: string | string[]): string {
    if (status >= 500) {
      return 'Internal server error';
    }
    return Array.isArray(message) ? message.join(', ') : message;
  }
}
