import { Controller, Get } from '@nestjs/common';
import { Response } from 'express';
import { SkipThrottle } from '../../common/decorators/skip-throttle.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { AmqpService } from '../../infrastructure/messaging/amqp.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly cache: CacheService,
    private readonly amqp: AmqpService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @SkipThrottle()
  @Public()
  async check() {
    const [redisStatus, rabbitStatus, dbStatus] = await Promise.all([
      this.getRedisStatus(),
      Promise.resolve(this.getRabbitStatus()),
      this.getDbStatus(),
    ]);

    const overallStatus =
      redisStatus.status === 'up' &&
      rabbitStatus.status === 'up' &&
      dbStatus.status === 'up'
        ? 'ok'
        : 'degraded';

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services: {
        redis: redisStatus,
        rabbitmq: rabbitStatus,
        postgresql: dbStatus,
      },
    };
  }

  private async getRedisStatus(): Promise<{
    status: string;
    latencyMs?: number;
    error?: string;
  }> {
    try {
      const start = Date.now();
      await this.cache['redis'].ping();
      return { status: 'up', latencyMs: Date.now() - start };
    } catch (error) {
      return {
        status: 'down',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private getRabbitStatus(): { status: string; error?: string } {
    if (this.amqp.isReady()) {
      return { status: 'up' };
    }
    return { status: 'down', error: 'Not connected' };
  }

  private async getDbStatus(): Promise<{
    status: string;
    latencyMs?: number;
    error?: string;
  }> {
    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'up', latencyMs: Date.now() - start };
    } catch (error) {
      return {
        status: 'down',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
