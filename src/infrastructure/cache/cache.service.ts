import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { AppLogger } from '../../common/logger/logger.service';

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly redis: Redis;
  private readonly defaultTTL = 300; // 5 minutes
  private isConnected = false;

  constructor(private readonly logger: AppLogger) {
    const redisOptions: Record<
      string,
      string | number | boolean | ((times: number) => number)
    > = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      retryStrategy: (times: number) => Math.min(times * 50, 2000),
      lazyConnect: true,
    };

    // Only add password if REDIS_PASS is set and not empty
    const redisPass = process.env.REDIS_PASS;
    if (redisPass && redisPass.trim() !== '') {
      redisOptions.password = redisPass;
    }

    this.redis = new Redis(redisOptions);

    this.redis.on('connect', () => {
      this.isConnected = true;
    });

    this.redis.on('error', (err: Error) => {
      this.logger.error('Redis error', err.message, 'CacheService');
    });

    this.redis.on('close', () => {
      this.isConnected = false;
      this.logger.warn('Redis connection closed', 'CacheService');
    });

    this.redis.connect().catch((err: Error) => {
      this.isConnected = false;
      this.logger.warn(
        `Redis connection failed, caching disabled: ${err.message}`,
        'CacheService',
      );
    });
  }

  isReady(): boolean {
    return this.isConnected;
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.redis.get(key);
      if (data === null) {
        return null;
      }
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      await this.redis.setex(key, ttl ?? this.defaultTTL, serialized);
    } catch {
      // Silently fail - cache is non-critical
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch {
      // Silently fail - cache is non-critical
    }
  }

  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }
    const value = await factory();
    await this.set(key, value, ttl);
    return value;
  }
}
