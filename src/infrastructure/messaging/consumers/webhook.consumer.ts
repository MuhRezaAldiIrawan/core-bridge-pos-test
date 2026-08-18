import { Injectable, OnModuleInit } from '@nestjs/common';
import { AmqpService } from '../amqp.service';
import { TransactionService } from '../../../modules/transaction/transaction.service';
import { PrismaService } from '../../database/prisma.service';
import {
  WebhookService,
  WebhookPayload,
} from '../../../modules/webhook/webhook.service';
import { AppLogger } from '../../../common/logger/logger.service';
import { TransactionStatus } from '../../../modules/transaction/dto/update-status.dto';

export interface WebhookQueueMessage {
  transactionId: string;
  webhookUrl: string;
  payload: WebhookPayload;
  webhookSecret: string;
  attempt: number;
  processorCode: string;
}

@Injectable()
export class WebhookConsumer implements OnModuleInit {
  constructor(
    private readonly amqpService: AmqpService,
    private readonly transactionService: TransactionService,
    private readonly webhookService: WebhookService,
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
            `Failed to start webhook consumer for ${app.code}: ${error instanceof Error ? error.message : String(error)}`,
            'WebhookConsumer',
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to fetch applications for consumer startup: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
        'WebhookConsumer',
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
      'RabbitMQ connection ready. Starting webhook consumers...',
      'WebhookConsumer',
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

    await this.amqpService.consumeWebhook(
      (message: WebhookQueueMessage) => this.handleWebhook(message),
      processorCode,
    );
    this.logger.log(
      `Webhook consumer started for processor: ${processorCode}`,
      'WebhookConsumer',
    );
  }

  private async handleWebhook(message: WebhookQueueMessage): Promise<void> {
    const { transactionId, webhookUrl, payload, webhookSecret } = message;

    try {
      const result = await this.webhookService.send(
        webhookUrl,
        payload,
        webhookSecret,
        transactionId,
      );

      if (result.success) {
        // HST responded with 2xx
        await this.transactionService.updateStatus({
          transactionId,
          status: TransactionStatus.SUCCESS,
          retryCount: result.attemptsMade,
          details: {
            httpStatus: result.httpStatus,
            responseBody: result.responseBody,
            webhookPayload: payload,
            attemptsMade: result.attemptsMade,
          },
        });
      } else {
        // All retries exhausted - extract error from HST response
        let errorCode = 'WEBHOOK_FAILED';
        let errorMessage = 'HST did not respond after max retries';

        // Try to parse error details from response body
        if (result.responseBody) {
          try {
            const parsedResponse = JSON.parse(result.responseBody) as Record<
              string,
              unknown
            >;
            const errCode = parsedResponse.error_code;
            const errMsg = parsedResponse.error_message;
            if (typeof errCode === 'string' && errCode) {
              errorCode = errCode;
            }
            if (typeof errMsg === 'string' && errMsg) {
              errorMessage = errMsg;
            }
          } catch {
            // If parsing fails, keep default error values
          }
        }

        await this.transactionService.updateStatus({
          transactionId,
          status: TransactionStatus.FAILED,
          errorCode,
          errorMessage,
          retryCount: result.attemptsMade,
          details: {
            webhookPayload: payload,
            lastHttpStatus: result.httpStatus,
            lastResponseBody: result.responseBody,
            attemptsMade: result.attemptsMade,
          },
        });
      }
    } catch (error) {
      this.logger.error(
        `Webhook error for ${transactionId}: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        'WebhookConsumer',
      );

      // Mark as FAILED on system errors
      await this.transactionService.updateStatus({
        transactionId,
        status: TransactionStatus.FAILED,
        errorCode: 'SYSTEM_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error; // Rethrow to trigger nack/DLQ
    }
  }
}
