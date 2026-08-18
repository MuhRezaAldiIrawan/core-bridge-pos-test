import { Injectable, OnModuleInit } from '@nestjs/common';
import { AmqpService } from '../amqp.service';
import { TransactionService } from '../../../modules/transaction/transaction.service';
import { PrismaService } from '../../database/prisma.service';
import { AppLogger } from '../../../common/logger/logger.service';
import {
  QueueMessage,
  AccessResponsePayload,
} from '../interfaces/queue-message.interface';
import { TransactionStatus } from '../../../modules/transaction/dto/update-status.dto';
import { Prisma } from '@prisma/client';

type AccessResponseMessage = QueueMessage<AccessResponsePayload>;

@Injectable()
export class AccessResponseConsumer implements OnModuleInit {
  constructor(
    private readonly amqpService: AmqpService,
    private readonly transactionService: TransactionService,
    private readonly prisma: PrismaService,
    private readonly logger: AppLogger,
  ) {}

  async onModuleInit(): Promise<void> {
    // Wait for RabbitMQ to be ready
    await this.waitForRabbitMQ();

    // Start consumers for all existing processors
    try {
      const applications = await this.prisma.application.findMany();
      for (const app of applications) {
        try {
          await this.startConsumerForProcessor(app.code);
        } catch (error) {
          this.logger.warn(
            `Failed to start access response consumer for ${app.code}: ${error instanceof Error ? error.message : String(error)}`,
            'AccessResponseConsumer',
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to fetch applications for consumer startup: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
        'AccessResponseConsumer',
      );
    }
  }

  private async waitForRabbitMQ(maxWaitMs = 30000): Promise<void> {
    const start = Date.now();
    while (!this.amqpService.isReady()) {
      if (Date.now() - start > maxWaitMs) {
        throw new Error('RabbitMQ connection timeout');
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    this.logger.log(
      'RabbitMQ connection ready. Starting access response consumers...',
      'AccessResponseConsumer',
    );
  }

  /**
   * Called by AmqpService after queues are created
   * Can also be called manually to start consumer for a processor
   */
  async startConsumerForProcessor(processorCode: string): Promise<void> {
    // Ensure queues exist before starting consumer
    await this.amqpService.ensureAllQueuesForProcessor(
      processorCode,
      'check-in',
    );

    await this.amqpService.consumeAccessResponse(
      (message: AccessResponseMessage) => this.handleResponse(message),
      processorCode,
    );
    this.logger.log(
      `Access response consumer started for processor: ${processorCode}`,
      'AccessResponseConsumer',
    );
  }

  private async handleResponse(message: AccessResponseMessage): Promise<void> {
    const data = message.data;
    const transactionId = data.transaction_id;

    // Missing transaction_id → NACK → DLQ (invalid message)
    if (!transactionId) {
      throw new Error('Missing transaction_id in access response');
    }

    try {
      const transaction = await this.transactionService.findById(transactionId);

      // Transaction not found → NACK → DLQ (need to investigate)
      if (!transaction) {
        throw new Error(`Transaction not found: ${transactionId}`);
      }

      // Already processed (duplicate) → ACK (no action needed)
      if (transaction.status === 'SUCCESS' || transaction.status === 'FAILED') {
        return;
      }

      // Extract member_uid from transaction params
      const params = transaction.params as Record<string, unknown>;
      const memberUid = params?.member_uid as string | undefined;

      // Build webhook payload
      const webhookPayload = {
        transaction_id: transaction.id,
        status: data.status.toLowerCase() as 'success' | 'failed',
        member_uid: memberUid,
        processed_at: data.processed_at,
        error_code: data.error_code || null,
        error_message: data.error_message || null,
      };

      // Atomic database update using Prisma transaction
      await this.prisma.$transaction(async (tx) => {
        // Update transaction to PROCESSING
        await tx.transaction.update({
          where: { id: transaction.id },
          data: {
            status: TransactionStatus.PROCESSING,
            errorCode: (data.error_code as string) || null,
            errorMessage: (data.error_message as string) || null,
          },
        });

        // Create transaction log for PROCESSING
        await tx.transactionLog.create({
          data: {
            transactionId: transaction.id,
            status: TransactionStatus.PROCESSING,
            action: 'MARK_PROCESSING',
            details: data as unknown as Prisma.InputJsonValue,
            errorCode: (data.error_code as string) || null,
            errorMessage: (data.error_message as string) || null,
          },
        });

        // Create transaction log for SENT_WEBHOOK
        await tx.transactionLog.create({
          data: {
            transactionId: transaction.id,
            status: TransactionStatus.PROCESSING,
            action: 'SENT_WEBHOOK',
            details: webhookPayload,
          },
        });
      });

      // Publish webhook to queue (outside transaction - non-critical)
      if (transaction.webhookUrl) {
        try {
          await this.amqpService.publishWebhook({
            transactionId: transaction.id,
            webhookUrl: transaction.webhookUrl,
            payload: webhookPayload,
            webhookSecret:
              transaction.application?.webhookSecret ||
              process.env.WEBHOOK_SECRET ||
              'default-secret',
            attempt: 1,
            processorCode: transaction.processorCode,
          });
        } catch (webhookError) {
          // Log but don't throw - webhook consumer will handle retry
          this.logger.error(
            `Webhook publish failed for ${transactionId}: ${webhookError instanceof Error ? webhookError.message : String(webhookError)}`,
            undefined,
            'AccessResponseConsumer',
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Error processing response for ${transactionId}: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        'AccessResponseConsumer',
      );
      throw error;
    }
  }
}
