import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { CommonModule } from './common/common.module';
import { DatabaseModule } from './infrastructure/database/database.module';
import { CacheModule } from './infrastructure/cache/cache.module';
import { HealthModule } from './modules/health/health.module';
import { ApplicationModule } from './modules/application/application.module';
import { CheckinModule } from './modules/checkin/checkin.module';
import { CheckimageModule } from './modules/checkimage/checkimage.module';
import { TransactionModule } from './modules/transaction/transaction.module';
import { MessagingModule } from './infrastructure/messaging/messaging.module';
import { WebhookModule } from './modules/webhook/webhook.module';
import { RootModule } from './modules/root/root.module';
import { ApiKeyGuard } from './common/guards/api-key.guard';
import { IpWhitelistGuard } from './common/guards/ip-whitelist.guard';
import { RateLimitGuard } from './common/guards/throttler.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: parseInt(process.env.RATE_LIMIT_TTL || '60', 10) * 1000,
        limit: parseInt(process.env.RATE_LIMIT_LIMIT || '300', 10),
      },
    ]),
    DatabaseModule,
    CacheModule,
    MessagingModule,
    CommonModule,
    HealthModule,
    ApplicationModule,
    CheckinModule,
    CheckimageModule,
    TransactionModule,
    WebhookModule,
    RootModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ApiKeyGuard,
    },
    {
      provide: APP_GUARD,
      useClass: IpWhitelistGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
  ],
})
export class AppModule {}
