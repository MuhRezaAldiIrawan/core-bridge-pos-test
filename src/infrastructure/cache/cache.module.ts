import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache.service';
import { AppLogger } from '../../common/logger/logger.service';

@Global()
@Module({
  providers: [CacheService, AppLogger],
  exports: [CacheService],
})
export class CacheModule {}
