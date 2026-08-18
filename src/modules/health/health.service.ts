import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import Redis from 'ioredis';
import * as mysql from 'mysql2/promise';

export interface HealthStatus {
  status: 'ok' | 'error';
  timestamp: string;
  services: {
    app: {
      status: 'ok';
      port: number;
    };
    database: {
      status: 'ok' | 'error';
      connected: boolean;
      error?: string;
    };
    rabbitmq: {
      status: 'ok' | 'error';
      connected: boolean;
      url?: string;
      error?: string;
    };
    redis: {
      status: 'ok' | 'error';
      connected: boolean;
      host?: string;
      error?: string;
    };
  };
}

@Injectable()
export class HealthService {
  constructor(private configService: ConfigService) {}

  async check(): Promise<HealthStatus> {
    const [appStatus, databaseStatus, rabbitmqStatus, redisStatus] =
      await Promise.all([
        Promise.resolve(this.checkApp()),
        this.checkDatabase(),
        this.checkRabbitMQ(),
        this.checkRedis(),
      ]);

    const isHealthy =
      appStatus.status === 'ok' &&
      databaseStatus.status === 'ok' &&
      rabbitmqStatus.status === 'ok' &&
      redisStatus.status === 'ok';

    return {
      status: isHealthy ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      services: {
        app: appStatus,
        database: databaseStatus,
        rabbitmq: rabbitmqStatus,
        redis: redisStatus,
      },
    };
  }

  private checkApp() {
    const port = this.configService.get<string>('port');
    return {
      status: 'ok' as const,
      port: port ? parseInt(port, 10) : 0,
    };
  }

  private async checkDatabase(): Promise<{
    status: 'ok' | 'error';
    connected: boolean;
    error?: string;
  }> {
    const dbUrl = this.configService.get<string>('database.url');

    if (!dbUrl) {
      return {
        status: 'error',
        connected: false,
        error: 'DATABASE_URL not configured',
      };
    }

    const pool = mysql.createPool({
      uri: dbUrl,
      connectionLimit: 1,
      connectTimeout: 5000,
    });

    try {
      await pool.query('SELECT 1 as test');
      await pool.end();
      return {
        status: 'ok',
        connected: true,
      };
    } catch (error) {
      await pool.end().catch(() => {});
      return {
        status: 'error',
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async checkRabbitMQ(): Promise<{
    status: 'ok' | 'error';
    connected: boolean;
    url?: string;
    error?: string;
  }> {
    const url = this.configService.get<string>('rabbitmq.url');

    if (!url) {
      return {
        status: 'error',
        connected: false,
        error: 'RABBITMQ_URL not configured',
      };
    }

    try {
      const connection = await amqp.connect(url);
      await connection.close();

      return {
        status: 'ok',
        connected: true,
      };
    } catch (error) {
      return {
        status: 'error',
        connected: false,
        url: url,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async checkRedis(): Promise<{
    status: 'ok' | 'error';
    connected: boolean;
    host?: string;
    error?: string;
  }> {
    const host = this.configService.get<string>('redis.host');
    const port = this.configService.get<string>('redis.port');
    const pass = this.configService.get<string>('redis.pass');

    if (!host || !port) {
      return {
        status: 'error',
        connected: false,
        error: 'REDIS configuration not found',
      };
    }

    const redis = new Redis({
      host,
      port: parseInt(port, 10),
      password: pass || undefined,
      connectTimeout: 5000,
      lazyConnect: true,
    });

    try {
      await redis.ping();
      await redis.quit();

      return {
        status: 'ok',
        connected: true,
      };
    } catch (error) {
      return {
        status: 'error',
        connected: false,
        host: `${host}:${port}`,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
