import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqp-connection-manager';
import { ChannelWrapper, AmqpConnectionManager } from 'amqp-connection-manager';
import { Channel, ConsumeMessage } from 'amqplib';
import { v4 as uuidv4 } from 'uuid';
import { AppLogger } from '../../common/logger/logger.service';
import {
  RabbitMQConfig,
  QueueMessage,
  AccessRequestPayload,
  CheckimageRequestPayload,
  AccessResponsePayload,
} from './interfaces/queue-message.interface';
import { WebhookQueueMessage } from '../../modules/webhook/webhook.service';

@Injectable()
export class AmqpService implements OnModuleInit, OnModuleDestroy {
  private connection!: AmqpConnectionManager;
  private channelWrapper!: ChannelWrapper;
  private readonly config: RabbitMQConfig;
  private isConnected = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: AppLogger,
  ) {
    this.config = {
      url: this.configService.get<string>(
        'RABBITMQ_URL',
        'amqp://guest:guest@localhost:5672',
      ),
      exchangeAccessRequest: this.configService.get<string>(
        'RABBITMQ_EXCHANGE_ACCESS_REQUEST',
        'access_request',
      ),
      exchangeAccessResponse: this.configService.get<string>(
        'RABBITMQ_EXCHANGE_ACCESS_RESPONSE',
        'access_response',
      ),
      exchangeWebhook: this.configService.get<string>(
        'RABBITMQ_EXCHANGE_WEBHOOK',
        'webhook',
      ),
      dlxAccessRequest: this.configService.get<string>(
        'RABBITMQ_DLX_ACCESS_REQUEST',
        'dlx.access_request',
      ),
      dlxAccessResponse: this.configService.get<string>(
        'RABBITMQ_DLX_ACCESS_RESPONSE',
        'dlx.access_response',
      ),
      dlxWebhook: this.configService.get<string>(
        'RABBITMQ_DLX_WEBHOOK',
        'dlx.webhook',
      ),
    };
  }

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  private async connect(): Promise<void> {
    try {
      this.connection = amqp.connect([this.config.url], {
        heartbeatIntervalInSeconds: 30,
        reconnectTimeInSeconds: 5,
      });

      this.connection.on('connect', () => {
        this.isConnected = true;
      });

      this.connection.on('disconnect', (params: { err?: Error }) => {
        this.isConnected = false;
        this.logger.warn(
          `RabbitMQ disconnected: ${params?.err?.message || 'Unknown'}`,
          'AmqpService',
        );
      });

      this.connection.on('connectFailed', (params: { err?: Error }) => {
        this.logger.error(
          `RabbitMQ connection failed: ${params?.err?.message || 'Unknown'}`,
          params?.err?.stack,
          'AmqpService',
        );
      });

      this.channelWrapper = this.connection.createChannel({
        json: true,
        setup: async (channel: Channel) => {
          await this.setupExchangesAndQueues(channel);
        },
      });

      await this.channelWrapper.waitForConnect();
    } catch (error) {
      this.logger.error(
        `Failed to connect to RabbitMQ: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
        'AmqpService',
      );
    }
  }

  private async setupExchangesAndQueues(channel: Channel): Promise<void> {
    // ===== Main Exchanges =====
    await channel.assertExchange(this.config.exchangeAccessRequest, 'direct', {
      durable: true,
    });
    await channel.assertExchange(this.config.exchangeAccessResponse, 'direct', {
      durable: true,
    });
    await channel.assertExchange(this.config.exchangeWebhook, 'direct', {
      durable: true,
    });

    // ===== Dead Letter Exchanges (DLX) =====
    await channel.assertExchange(this.config.dlxAccessRequest, 'direct', {
      durable: true,
    });
    await channel.assertExchange(this.config.dlxAccessResponse, 'direct', {
      durable: true,
    });
    await channel.assertExchange(this.config.dlxWebhook, 'direct', {
      durable: true,
    });

    // NOTE: All queues (request, response, webhook, DLQ) are created dynamically per processor
    // via ensureQueueForProcessor(), ensureResponseQueueForProcessor(), and consumeWebhook()
  }

  private async disconnect(): Promise<void> {
    try {
      if (this.channelWrapper) await this.channelWrapper.close();
      if (this.connection) await this.connection.close();
      this.isConnected = false;
    } catch (error) {
      this.logger.error(
        `Error disconnecting from RabbitMQ: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
        'AmqpService',
      );
    }
  }

  isReady(): boolean {
    return this.isConnected && this.channelWrapper !== undefined;
  }

  private sanitizeApplicationCode(code: string): string {
    return code.replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
  }

  // ========== Queue Creation Methods ==========

  /**
   * Create all queues (access-request, access-response, webhook) for a processor
   * Called on-demand when first request comes in
   */
  async ensureAllQueuesForProcessor(
    processorCode: string,
    action: 'check-in' | 'check-image',
  ): Promise<void> {
    await this.channelWrapper.addSetup(async (channel: Channel) => {
      // 1. Access Request + DLQ
      await this.createAccessRequestQueues(channel, processorCode, action);

      // 2. Access Response + DLQ
      await this.createAccessResponseQueues(channel, processorCode);

      // 3. Webhook + DLQ
      await this.createWebhookQueues(channel, processorCode);
    });
  }

  private async createAccessRequestQueues(
    channel: Channel,
    processorCode: string,
    action: 'check-in' | 'check-image',
  ): Promise<void> {
    const queueName = `q.access-request.${action}.${processorCode}`;
    const dlqName = `dlq.access-request.${action}.${processorCode}`;
    const routingKey = `access.request.${action}.${processorCode}`;
    const dlqRoutingKey = `dlq.access-request.${action}.${processorCode}`;

    await channel.assertQueue(dlqName, { durable: true });
    await channel.bindQueue(
      dlqName,
      this.config.dlxAccessRequest,
      dlqRoutingKey,
    );

    await channel.assertQueue(queueName, {
      durable: true,
      deadLetterExchange: this.config.dlxAccessRequest,
      deadLetterRoutingKey: dlqRoutingKey,
    });
    await channel.bindQueue(
      queueName,
      this.config.exchangeAccessRequest,
      routingKey,
    );
  }

  private async createAccessResponseQueues(
    channel: Channel,
    processorCode: string,
  ): Promise<void> {
    const queueName = `q.access_response.${processorCode}`;
    const dlqName = `dlq.access_response.${processorCode}`;
    const routingKey = `access.response.${processorCode}`;
    const dlqRoutingKey = `dlq.access_response.${processorCode}`;

    await channel.assertQueue(dlqName, { durable: true });
    await channel.bindQueue(
      dlqName,
      this.config.dlxAccessResponse,
      dlqRoutingKey,
    );

    await channel.assertQueue(queueName, {
      durable: true,
      deadLetterExchange: this.config.dlxAccessResponse,
      deadLetterRoutingKey: dlqRoutingKey,
    });
    await channel.bindQueue(
      queueName,
      this.config.exchangeAccessResponse,
      routingKey,
    );
  }

  private async createWebhookQueues(
    channel: Channel,
    processorCode: string,
  ): Promise<void> {
    const queueName = `q.webhook.${processorCode}`;
    const dlqName = `dlq.webhook.${processorCode}`;
    const routingKey = `webhook.${processorCode}`;
    const dlqRoutingKey = `dlq.webhook.${processorCode}`;

    await channel.assertQueue(dlqName, { durable: true });
    await channel.bindQueue(dlqName, this.config.dlxWebhook, dlqRoutingKey);

    await channel.assertQueue(queueName, {
      durable: true,
      deadLetterExchange: this.config.dlxWebhook,
      deadLetterRoutingKey: dlqRoutingKey,
    });
    await channel.bindQueue(queueName, this.config.exchangeWebhook, routingKey);
  }

  // ========== Publish Methods ==========

  async publishAccessRequest(
    applicationCode: string,
    payload: AccessRequestPayload,
    correlationId?: string,
  ): Promise<string> {
    if (!this.channelWrapper) {
      throw new Error('RabbitMQ channel not initialized');
    }

    const id = uuidv4();
    const corrId = correlationId || uuidv4();
    const processorCode = this.sanitizeApplicationCode(payload.processor_code);
    const queueName = `q.access-request.check-in.${processorCode}`;

    const message: QueueMessage<AccessRequestPayload> = {
      id,
      correlation_id: corrId,
      timestamp: new Date(),
      data: payload,
    };

    try {
      // Create ALL queues for this processor (access-request, access-response, webhook)
      await this.ensureAllQueuesForProcessor(processorCode, 'check-in');

      await this.channelWrapper.sendToQueue(queueName, message, {
        persistent: true,
        correlationId: corrId,
        messageId: id,
        contentType: 'application/json',
        headers: {
          applicationCode,
          processorCode,
          venueId: payload.venue_id,
        },
      });

      return corrId;
    } catch (error) {
      this.logger.error(
        `Failed to publish access request: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
        'AmqpService',
      );
      throw error;
    }
  }

  async publishCheckimageRequest(
    applicationCode: string,
    payload: CheckimageRequestPayload,
    correlationId?: string,
  ): Promise<string> {
    if (!this.channelWrapper) {
      throw new Error('RabbitMQ channel not initialized');
    }

    const id = uuidv4();
    const corrId = correlationId || uuidv4();
    const processorCode = this.sanitizeApplicationCode(payload.processor_code);
    const queueName = `q.access-request.check-image.${processorCode}`;

    const message: QueueMessage<CheckimageRequestPayload> = {
      id,
      correlation_id: corrId,
      timestamp: new Date(),
      data: payload,
    };

    try {
      // Create ALL queues for this processor (access-request, access-response, webhook)
      await this.ensureAllQueuesForProcessor(processorCode, 'check-image');

      await this.channelWrapper.sendToQueue(queueName, message, {
        persistent: true,
        correlationId: corrId,
        messageId: id,
        contentType: 'application/json',
        headers: {
          applicationCode,
          processorCode,
        },
      });

      return corrId;
    } catch (error) {
      this.logger.error(
        `Failed to publish checkimage request: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
        'AmqpService',
      );
      throw error;
    }
  }

  // ========== Consumer Methods ==========

  async consumeAccessResponse(
    handler: (message: QueueMessage<AccessResponsePayload>) => Promise<void>,
    processorCode: string = 'WRP001',
  ): Promise<void> {
    const queueName = `q.access_response.${processorCode}`;
    let retryCount = 0;
    const maxRetries = 10;

    await this.channelWrapper.addSetup(async (channel: Channel) => {
      // Retry logic: wait for queue to exist with exponential backoff
      while (retryCount < maxRetries) {
        try {
          await channel.checkQueue(queueName);
          await channel.consume(
            queueName,
            (msg) => {
              if (!msg) return;
              void this.processAccessResponseMessage(channel, msg, handler);
            },
            { noAck: false },
          );
          this.logger.log(
            `Access response consumer registered for queue: ${queueName}`,
            'AmqpService',
          );
          return; // Success - exit retry loop
        } catch (_error) {
          retryCount++;
          if (retryCount < maxRetries) {
            // Wait before retry with exponential backoff
            const waitMs = Math.min(1000 * Math.pow(2, retryCount - 1), 30000);
            this.logger.warn(
              `Queue ${queueName} not found (attempt ${retryCount}/${maxRetries}). Retrying in ${waitMs}ms...`,
              'AmqpService',
            );
            await new Promise((resolve) => setTimeout(resolve, waitMs));
          }
        }
      }

      // Final attempt - if still fails, log error but don't throw (queue may exist later)
      this.logger.error(
        `Failed to register consumer for queue ${queueName} after ${maxRetries} attempts`,
        undefined,
        'AmqpService',
      );
    });
  }

  private async processAccessResponseMessage(
    channel: Channel,
    msg: ConsumeMessage,
    handler: (message: QueueMessage<AccessResponsePayload>) => Promise<void>,
  ): Promise<void> {
    try {
      const raw = JSON.parse(msg.content.toString()) as Record<string, unknown>;

      // Handle both wrapped (QueueMessage) and unwrapped (raw payload) formats
      // Wristpay sends raw payload directly without envelope
      const content: QueueMessage<AccessResponsePayload> = raw.data
        ? (raw as unknown as QueueMessage<AccessResponsePayload>)
        : {
            id: (msg.properties.messageId as string) || uuidv4(),
            correlation_id:
              (msg.properties.correlationId as string) ||
              (raw.transaction_id as string) ||
              uuidv4(),
            timestamp: new Date(),
            data: raw as unknown as AccessResponsePayload,
          };

      await handler(content);
      channel.ack(msg);
    } catch (_error) {
      this.logger.error(
        `Error processing access response: ${_error instanceof Error ? _error.message : String(_error)}`,
        _error instanceof Error ? _error.stack : undefined,
        'AmqpService',
      );
      channel.nack(msg, false, false);
    }
  }

  // Publish webhook to queue for async sending
  async publishWebhook(message: WebhookQueueMessage): Promise<void> {
    if (!this.channelWrapper) {
      throw new Error('RabbitMQ channel not initialized');
    }

    // Use processorCode from message (dynamically set from transaction)
    const processorCode = message.processorCode || 'WRP001';
    const queueName = `q.webhook.${processorCode}`;

    // Note: Don't re-declare queue if exists, just send the message
    // Queue was created by consumer during startup
    await this.channelWrapper.sendToQueue(queueName, message, {
      persistent: true,
      correlationId: message.transactionId,
      contentType: 'application/json',
      headers: {
        attempt: message.attempt,
        transactionId: message.transactionId,
      },
    });
  }

  async consumeWebhook(
    handler: (message: WebhookQueueMessage) => Promise<void>,
    processorCode: string = 'WRP001',
  ): Promise<void> {
    const queueName = `q.webhook.${processorCode}`;
    let retryCount = 0;
    const maxRetries = 10;

    await this.channelWrapper.addSetup(async (channel: Channel) => {
      // Retry logic: wait for queue to exist with exponential backoff
      while (retryCount < maxRetries) {
        try {
          await channel.checkQueue(queueName);
          await channel.consume(
            queueName,
            (msg) => {
              if (!msg) return;
              void this.processWebhookMessage(msg, channel, handler);
            },
            { noAck: false },
          );
          this.logger.log(
            `Webhook consumer registered for queue: ${queueName}`,
            'AmqpService',
          );
          return; // Success - exit retry loop
        } catch (_error) {
          retryCount++;
          if (retryCount < maxRetries) {
            // Wait before retry with exponential backoff
            const waitMs = Math.min(1000 * Math.pow(2, retryCount - 1), 30000);
            this.logger.warn(
              `Queue ${queueName} not found (attempt ${retryCount}/${maxRetries}). Retrying in ${waitMs}ms...`,
              'AmqpService',
            );
            await new Promise((resolve) => setTimeout(resolve, waitMs));
          }
        }
      }

      // Final attempt - if still fails, log error but don't throw (queue may exist later)
      this.logger.error(
        `Failed to register consumer for queue ${queueName} after ${maxRetries} attempts`,
        undefined,
        'AmqpService',
      );
    });
  }

  private async processWebhookMessage(
    msg: ConsumeMessage,
    channel: Channel,
    handler: (message: WebhookQueueMessage) => Promise<void>,
  ): Promise<void> {
    try {
      const content = JSON.parse(msg.content.toString()) as WebhookQueueMessage;
      await handler(content);
      channel.ack(msg);
    } catch (_error) {
      this.logger.error(
        `Webhook send failed: ${_error instanceof Error ? _error.message : String(_error)}`,
        undefined,
        'AmqpService',
      );
      channel.nack(msg, false, false);
    }
  }
}
