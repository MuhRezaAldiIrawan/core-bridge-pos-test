import { Module } from '@nestjs/common';
import { AmqpService } from './amqp.service';
import { AccessResponseConsumer } from './consumers/access-response.consumer';
import { WebhookConsumer } from './consumers/webhook.consumer';
import { WebhookModule } from '../../modules/webhook/webhook.module';
import { TransactionModule } from '../../modules/transaction/transaction.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [WebhookModule, TransactionModule, DatabaseModule],
  providers: [AmqpService, AccessResponseConsumer, WebhookConsumer],
  exports: [AmqpService],
})
export class MessagingModule {}
