import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AppLogger } from '../../common/logger/logger.service';

export interface CreateWebhookLogDto {
  transactionId: string;
  url: string;
  requestPayload?: object | null;
  httpStatus?: number | null;
  responseBody?: string | null;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  attempt: number;
  errorMessage?: string | null;
  latencyMs?: number | null;
}

@Injectable()
export class WebhookLogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: AppLogger,
  ) {}

  async create(dto: CreateWebhookLogDto) {
    const log = await this.prisma.webhookLog.create({
      data: {
        transactionId: dto.transactionId,
        url: dto.url,
        requestPayload: dto.requestPayload ?? undefined,
        httpStatus: dto.httpStatus ?? undefined,
        responseBody: dto.responseBody ?? undefined,
        status: dto.status,
        attempt: dto.attempt,
        errorMessage: dto.errorMessage ?? undefined,
        latencyMs: dto.latencyMs ?? undefined,
        sentAt: new Date(),
        completedAt: dto.status !== 'PENDING' ? new Date() : undefined,
      },
    });

    // No console log - only for critical failures

    return log;
  }

  async findByTransactionId(transactionId: string) {
    return this.prisma.webhookLog.findMany({
      where: { transactionId },
      orderBy: { attempt: 'asc' },
    });
  }

  async updateToSuccess(
    logId: string,
    httpStatus: number,
    responseBody?: string,
    latencyMs?: number,
  ) {
    return this.prisma.webhookLog.update({
      where: { id: logId },
      data: {
        status: 'SUCCESS',
        httpStatus,
        responseBody,
        latencyMs,
        completedAt: new Date(),
      },
    });
  }

  async updateToFailed(
    logId: string,
    errorMessage: string,
    httpStatus?: number,
    responseBody?: string,
    latencyMs?: number,
  ) {
    return this.prisma.webhookLog.update({
      where: { id: logId },
      data: {
        status: 'FAILED',
        httpStatus,
        responseBody,
        errorMessage,
        latencyMs,
        completedAt: new Date(),
      },
    });
  }
}
