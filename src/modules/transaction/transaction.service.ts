import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Prisma, Transaction } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { AppLogger } from '../../common/logger/logger.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateStatusDto, TransactionStatus } from './dto/update-status.dto';
import {
  TransactionWithApplication,
  TransactionResult,
} from './interfaces/transaction.interfaces';

const TXN_CACHE_TTL = 1800;

@Injectable()
export class TransactionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly logger: AppLogger,
  ) {}

  async create(dto: CreateTransactionDto): Promise<TransactionResult> {
    const transactionId = uuidv4();
    const correlationId = dto.correlationId || uuidv4();

    // Look up processor application by code
    const processorApp = await this.prisma.application.findUnique({
      where: { code: dto.processorCode },
    });

    const transaction = await this.prisma.transaction.create({
      data: {
        id: transactionId,
        type: dto.type,
        applicationId: dto.applicationId,
        processorCode: dto.processorCode,
        processorApplicationId: processorApp?.id ?? null,
        webhookUrl: dto.webhookUrl,
        venueId: dto.venueId || 'N/A',
        params: (dto.payload as Prisma.InputJsonValue) ?? undefined,
        status: TransactionStatus.PENDING,
      },
    });

    await this.prisma.transactionLog.create({
      data: {
        transactionId,
        status: TransactionStatus.PENDING,
        action: 'CREATE_TRANSACTION',
        details: {
          applicationId: dto.applicationId,
          transactionId,
          processorCode: dto.processorCode,
          processorApplicationId: processorApp?.id ?? null,
        },
      },
    });

    this.logger.logWithCorrelationId(
      `Transaction created: ${transactionId}`,
      correlationId,
    );

    return { transaction, correlationId };
  }

  private getActionForStatus(status: TransactionStatus): string {
    switch (status) {
      case TransactionStatus.PENDING:
        return 'CREATE_TRANSACTION';
      case TransactionStatus.PUBLISHED:
        return 'PUBLISH_TO_QUEUE';
      case TransactionStatus.SUCCESS:
        return 'MARK_SUCCESS';
      case TransactionStatus.FAILED:
        return 'MARK_FAILED';
      case TransactionStatus.PROCESSING:
        return 'MARK_PROCESSING';
      default: {
        const _exhaustiveCheck: never = status;
        return `UPDATE_${String(_exhaustiveCheck)}`;
      }
    }
  }

  async updateStatus(dto: UpdateStatusDto): Promise<Transaction> {
    const {
      transactionId,
      status,
      errorCode,
      errorMessage,
      retryCount,
      details,
    } = dto;

    const transaction = await this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status,
        errorCode: errorCode || null,
        errorMessage: errorMessage || null,
        retryCount: retryCount ?? undefined,
      },
    });

    const action = this.getActionForStatus(status);
    const logDetails = details || { errorCode, errorMessage, retryCount };
    await this.prisma.transactionLog.create({
      data: {
        transactionId,
        status,
        action,
        details: logDetails as Prisma.InputJsonValue | undefined,
        errorCode,
        errorMessage,
      },
    });

    if (
      status === TransactionStatus.SUCCESS ||
      status === TransactionStatus.FAILED
    ) {
      await this.cache.set(
        `txn:${transactionId}`,
        { id: transactionId, status, errorCode, errorMessage },
        TXN_CACHE_TTL,
      );
    }

    this.logger.logWithCorrelationId(
      `Transaction ${transactionId} → ${status}`,
      transactionId,
    );

    return transaction;
  }

  async findById(id: string): Promise<TransactionWithApplication | null> {
    return this.prisma.transaction.findUnique({
      where: { id },
      include: { application: true },
    });
  }

  async findByTransactionId(
    transactionId: string,
  ): Promise<TransactionWithApplication | null> {
    return this.findById(transactionId);
  }

  async markWebhookSent(
    transactionId: string,
    rawData?: Record<string, unknown>,
  ): Promise<Transaction> {
    const transaction = await this.prisma.transaction.update({
      where: { id: transactionId },
      data: { status: TransactionStatus.PROCESSING },
    });

    await this.prisma.transactionLog.create({
      data: {
        transactionId,
        status: TransactionStatus.PROCESSING,
        action: 'SENT_WEBHOOK',
        details: (rawData || { sentAt: new Date() }) as Prisma.InputJsonValue,
      },
    });

    this.logger.logWithCorrelationId(
      `Webhook sent for ${transactionId}`,
      transactionId,
    );

    return transaction;
  }

  async updateStatusWithDetails(
    transactionId: string,
    status: TransactionStatus.PROCESSING,
    rawData: Record<string, unknown>,
  ): Promise<Transaction> {
    // Extract error fields from raw data for transaction table
    const errorCode = (rawData.error_code as string) || null;
    const errorMessage = (rawData.error_message as string) || null;

    const transaction = await this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status,
        errorCode,
        errorMessage,
      },
    });

    await this.prisma.transactionLog.create({
      data: {
        transactionId,
        status,
        action: 'MARK_PROCESSING',
        details: rawData as Prisma.InputJsonValue,
        errorCode,
        errorMessage,
      },
    });

    this.logger.logWithCorrelationId(
      `Transaction ${transactionId} → PROCESSING`,
      transactionId,
    );

    return transaction;
  }
}
