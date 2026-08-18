import { Module } from '@nestjs/common';
import { CheckimageService } from './checkimage.service';
import { CheckimageController } from './checkimage.controller';
import { TransactionModule } from '../transaction/transaction.module';
import { MessagingModule } from '../../infrastructure/messaging/messaging.module';

@Module({
  imports: [TransactionModule, MessagingModule],
  controllers: [CheckimageController],
  providers: [CheckimageService],
})
export class CheckimageModule {}
