import { Injectable } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import { Request } from 'express';

@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
  protected throwThrottlingException(): never {
    throw new ThrottlerException(
      'Rate limit exceeded. Please try again later.',
    );
  }

  protected getTracker(req: Request): Promise<string> {
    return Promise.resolve(
      (req.headers['x-api-key'] as string) || req.ip || 'unknown',
    );
  }
}
