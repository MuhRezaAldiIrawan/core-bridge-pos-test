import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Application } from '@prisma/client';

export const APPLICATION_KEY = 'application';

export const CurrentApplication = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Application | null => {
    const request = ctx.switchToHttp().getRequest();
    return request[APPLICATION_KEY] ?? null;
  },
);
