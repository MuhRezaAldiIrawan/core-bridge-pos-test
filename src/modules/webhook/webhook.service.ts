import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';
import * as crypto from 'crypto';
import { AppLogger } from '../../common/logger/logger.service';
import { WebhookLogService } from './webhook-log.service';

export interface WebhookPayload {
  transaction_id: string;
  status: 'success' | 'failed';
  member_uid?: string;
  processed_at: string;
  error_code: string | null;
  error_message: string | null;
}

export interface WebhookQueueMessage {
  transactionId: string;
  webhookUrl: string;
  payload: WebhookPayload;
  webhookSecret: string;
  attempt: number;
  processorCode: string;
}

@Injectable()
export class WebhookService {
  private readonly timeout: number;
  private readonly retryDelays: number[];
  private readonly maxRetries: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: AppLogger,
    private readonly webhookLogService: WebhookLogService,
  ) {
    this.timeout = this.configService.get<number>('WEBHOOK_TIMEOUT_MS', 10000);
    this.maxRetries = this.configService.get<number>('WEBHOOK_MAX_RETRIES', 3);
    this.retryDelays = this.configService
      .get<string>('WEBHOOK_RETRY_DELAYS', '5000,15000,45000')
      .split(',')
      .map(Number);
  }

  async send(
    webhookUrl: string,
    payload: WebhookPayload,
    webhookSecret: string,
    transactionId: string,
  ): Promise<{
    success: boolean;
    httpStatus?: number;
    responseBody?: string;
    attemptsMade: number;
  }> {
    this.validateWebhookUrl(webhookUrl);

    const payloadString = JSON.stringify(payload);
    let attemptsMade = 0;
    let lastHttpStatus: number | undefined;
    let lastResponseBody: string | undefined;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      attemptsMade = attempt;
      const startTime = Date.now();

      const logEntry = await this.webhookLogService.create({
        transactionId,
        url: webhookUrl,
        requestPayload: payload,
        status: 'PENDING',
        attempt,
      });

      try {
        const timestamp = new Date().toISOString();
        const signature = this.generateSignature(
          webhookSecret,
          payloadString,
          timestamp,
        );

        // Mock headers for development/testing
        const mockResponseCode = this.configService.get<string>(
          'WEBHOOK_MOCK_RESPONSE_CODE',
          '200',
        );

        const response = await axios.post(webhookUrl, payloadString, {
          timeout: this.timeout,
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-API-Key': webhookSecret,
            'X-Mock-Response-Code': mockResponseCode,
            'X-Directory': 'hst',
            'X-Signature': signature,
            'X-Timestamp': timestamp,
            'X-Correlation-ID': transactionId,
          },
        });

        const latencyMs = Date.now() - startTime;

        await this.webhookLogService.updateToSuccess(
          logEntry.id,
          response.status,
          typeof response.data === 'string'
            ? response.data
            : JSON.stringify(response.data),
          latencyMs,
        );

        return {
          success: true,
          httpStatus: response.status,
          responseBody:
            typeof response.data === 'string'
              ? response.data
              : JSON.stringify(response.data),
          attemptsMade,
        };
      } catch (error) {
        const axiosError = error as AxiosError;
        const latencyMs = Date.now() - startTime;

        // Extract response details if available (e.g., HST returned 400 with error body)
        lastHttpStatus = axiosError.response?.status;
        lastResponseBody = axiosError.response?.data
          ? typeof axiosError.response.data === 'string'
            ? axiosError.response.data
            : JSON.stringify(axiosError.response.data)
          : axiosError.message;
        // Webhook attempt failure logged by consumer

        await this.webhookLogService.updateToFailed(
          logEntry.id,
          axiosError.message,
          lastHttpStatus,
          lastResponseBody,
          latencyMs,
        );

        if (attempt < this.maxRetries) {
          await this.sleep(this.getRetryDelay(attempt));
        }
      }
    }

    return {
      success: false,
      attemptsMade,
      httpStatus: lastHttpStatus,
      responseBody: lastResponseBody,
    };
  }

  private getRetryDelay(attempt: number): number {
    if (attempt > 0 && attempt <= this.retryDelays.length) {
      return this.retryDelays[attempt - 1] || 5000 * attempt;
    }
    return 5000 * attempt;
  }

  private validateWebhookUrl(url: string): void {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') {
        throw new Error('Webhook URL must use HTTPS');
      }
      const hostname = parsed.hostname.toLowerCase();
      const blockedPatterns = ['localhost', '127.0.0.1', '::1', '0.0.0.0'];
      if (
        hostname.startsWith('10.') ||
        hostname.startsWith('192.168.') ||
        (hostname.startsWith('172.') && this.isPrivate172Block(hostname))
      ) {
        throw new Error('Webhook URL cannot point to internal addresses');
      }
      for (const pattern of blockedPatterns) {
        if (hostname === pattern || hostname.startsWith(`${pattern}.`)) {
          throw new Error('Webhook URL cannot point to internal addresses');
        }
      }
      if (hostname.startsWith('fe80:')) {
        throw new Error('Webhook URL cannot point to internal addresses');
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Webhook URL')) {
        throw error;
      }
      throw new Error('Invalid webhook URL format');
    }
  }

  private isPrivate172Block(hostname: string): boolean {
    if (!hostname.startsWith('172.')) return false;
    const parts = hostname.split('.');
    if (parts.length < 2) return false;
    const secondOctet = parseInt(parts[1], 10);
    return secondOctet >= 16 && secondOctet <= 31;
  }

  private generateSignature(
    secret: string,
    payload: string,
    timestamp: string,
  ): string {
    const message = payload + timestamp;
    return crypto.createHmac('sha256', secret).update(message).digest('hex');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
