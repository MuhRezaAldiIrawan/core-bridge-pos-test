import { Module } from '@nestjs/common';
import { CheckinService } from './checkin.service';
import { CheckinController } from './checkin.controller';
import { TransactionModule } from '../transaction/transaction.module';
import { MessagingModule } from '../../infrastructure/messaging/messaging.module';

@Module({
  imports: [TransactionModule, MessagingModule],
  controllers: [CheckinController],
  providers: [CheckinService],
})
export class CheckinModule {}
