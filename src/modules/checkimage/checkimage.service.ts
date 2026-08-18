import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { TransactionService } from '../transaction/transaction.service';
import { AmqpService } from '../../infrastructure/messaging/amqp.service';
import { AppLogger } from '../../common/logger/logger.service';
import { CheckimageRequestDto } from './dto/checkimage-request.dto';
import { CheckimageResponseDto } from './dto/checkimage-response.dto';
import { CheckimageRequestPayload } from '../../infrastructure/messaging/interfaces/queue-message.interface';
import { formatDateTimeISO, nowDate } from '../../common/utils/date.utils';
import { TransactionStatus } from '../transaction/dto/update-status.dto';

@Injectable()
export class CheckimageService {
  constructor(
    private readonly transactionService: TransactionService,
    private readonly amqpService: AmqpService,
    private readonly logger: AppLogger,
  ) {}

  async createCheckimage(
    dto: CheckimageRequestDto,
    applicationId: string,
  ): Promise<CheckimageResponseDto> {
    const now = nowDate();

    if (!this.amqpService.isReady()) {
      throw new ServiceUnavailableException('Message queue unavailable');
    }

    const { transaction } = await this.transactionService.create({
      type: 'CHECK_IMAGE',
      correlationId: uuidv4(),
      processorCode: dto.processor_code,
      payload: dto as unknown as Record<string, unknown>,
      webhookUrl: dto.webhook_url,
      applicationId,
      venueId: 'N/A',
    });

    const payload: CheckimageRequestPayload = {
      transaction_id: transaction.id,
      member_uid: dto.member_uid,
      member_name: dto.member_name,
      image_url: dto.image_url,
      processor_code: dto.processor_code,
    };

    await this.amqpService.publishCheckimageRequest(
      dto.processor_code,
      payload,
      transaction.id,
    );

    // Pass raw payload data that was published to queue
    await this.transactionService.updateStatus({
      transactionId: transaction.id,
      status: TransactionStatus.PUBLISHED,
      details: {
        ...payload,
        publishedAt: now.toISOString(),
      },
    });

    return new CheckimageResponseDto({
      status: 'ACCEPTED',
      transaction_id: transaction.id,
      transaction_type: 'CHECK_IMAGE',
      queued_at: formatDateTimeISO(now),
    });
  }
}
