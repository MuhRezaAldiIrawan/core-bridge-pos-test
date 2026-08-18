import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import pino, { DestinationStream } from 'pino';

@Injectable()
export class AppLogger implements NestLoggerService {
  private logger: pino.Logger;
  private fileWriteStream: fs.WriteStream | null = null;
  private currentLogDate = '';

  constructor() {
    const logLevel = (process.env.LOG_LEVEL || 'debug').toLowerCase();
    const logDir = path.resolve(
      process.cwd(),
      process.env.LOG_DIR || 'storage/logs',
    );

    fs.mkdirSync(logDir, { recursive: true });

    const destination: DestinationStream = {
      write: (chunk: string | Uint8Array) => {
        this.ensureDailyFileStream(logDir);
        if (process.env.LOG_ENABLE_CONSOLE !== 'false') {
          process.stdout.write(String(chunk));
        }
        if (this.fileWriteStream) {
          this.fileWriteStream.write(String(chunk));
        }
      },
    };

    this.logger = pino(
      {
        level: logLevel,
        base: undefined,
        timestamp: pino.stdTimeFunctions.isoTime,
        formatters: {
          bindings: () => ({}),
        },
      },
      destination,
    );
  }

  private ensureDailyFileStream(logDir: string): void {
    const today = new Date().toISOString().slice(0, 10);

    if (this.currentLogDate === today && this.fileWriteStream) {
      return;
    }

    if (this.fileWriteStream) {
      this.fileWriteStream.end();
    }

    this.currentLogDate = today;
    const filePath = path.join(logDir, `app-${today}.log`);
    this.fileWriteStream = fs.createWriteStream(filePath, {
      flags: 'a',
      encoding: 'utf8',
    });
  }

  log(message: string, context?: string) {
    this.logger.info({ context }, message);
  }

  error(message: string, trace?: string, context?: string) {
    this.logger.error({ context, trace }, message);
  }

  warn(message: string, context?: string) {
    this.logger.warn({ context }, message);
  }

  debug(message: string, context?: string) {
    this.logger.debug({ context }, message);
  }

  verbose(message: string, context?: string) {
    this.logger.trace({ context }, message);
  }

  /**
   * Structured log with additional metadata
   */
  logWithMeta(
    message: string,
    meta: Record<string, unknown>,
    context?: string,
  ) {
    this.logger.info({ context, ...meta }, message);
  }

  /**
   * Log correlation ID for request tracing
   */
  logWithCorrelationId(
    message: string,
    correlationId: string,
    meta?: Record<string, unknown>,
  ) {
    this.logger.info({ correlationId, ...meta }, message);
  }
}
