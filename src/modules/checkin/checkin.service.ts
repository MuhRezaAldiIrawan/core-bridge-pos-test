import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { TransactionService } from '../transaction/transaction.service';
import { AmqpService } from '../../infrastructure/messaging/amqp.service';
import { AppLogger } from '../../common/logger/logger.service';
import { CheckinRequestDto } from './dto/checkin-request.dto';
import { CheckinResponseDto } from './dto/checkin-response.dto';
import { AccessRequestPayload } from '../../infrastructure/messaging/interfaces/queue-message.interface';
import { formatDateTimeISO, nowDate } from '../../common/utils/date.utils';
import { TransactionStatus } from '../transaction/dto/update-status.dto';

@Injectable()
export class CheckinService {
  constructor(
    private readonly transactionService: TransactionService,
    private readonly amqpService: AmqpService,
    private readonly logger: AppLogger,
  ) {}

  async createCheckin(
    dto: CheckinRequestDto,
    applicationId: string,
    _applicationCode: string,
  ): Promise<CheckinResponseDto> {
    const now = nowDate();

    if (!this.amqpService.isReady()) {
      throw new ServiceUnavailableException('Message queue unavailable');
    }

    const { transaction } = await this.transactionService.create({
      type: 'CHECK_IN',
      correlationId: uuidv4(),
      processorCode: dto.processor_code,
      payload: dto as unknown as Record<string, unknown>,
      webhookUrl: dto.webhook_url,
      applicationId,
      venueId: dto.venue_id,
    });

    const payload: AccessRequestPayload = {
      transaction_id: transaction.id,
      member_uid: dto.member_uid,
      member_name: dto.member_name,
      image_url: dto.image_url,
      phone_number: dto.phone_number,
      email: dto.email,
      venue_id: dto.venue_id,
      site_code: dto.site_code,
      access_level_uid: dto.access_level_uid,
      product_id: dto.product_id,
      product_name: dto.product_name,
      product_type: dto.product_type,
      processor_code: dto.processor_code,
      checkin_timestamp: now.toISOString(),
    };

    await this.amqpService.publishAccessRequest(
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

    return new CheckinResponseDto({
      status: 'ACCEPTED',
      transaction_id: transaction.id,
      transaction_type: 'CREATE_ACCESS',
      queued_at: formatDateTimeISO(now),
    });
  }
}
