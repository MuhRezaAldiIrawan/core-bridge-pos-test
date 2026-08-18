import { Module } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { WebhookLogService } from './webhook-log.service';
import { AppLogger } from '../../common/logger/logger.service';

@Module({
  providers: [WebhookService, WebhookLogService, AppLogger],
  exports: [WebhookService, WebhookLogService],
})
export class WebhookModule {}
