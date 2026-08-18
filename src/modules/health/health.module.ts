import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { CacheModule } from '../../infrastructure/cache/cache.module';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { MessagingModule } from '../../infrastructure/messaging/messaging.module';

@Module({
  imports: [CacheModule, DatabaseModule, MessagingModule],
  controllers: [HealthController],
})
export class HealthModule {}
