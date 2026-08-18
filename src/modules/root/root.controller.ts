import { Controller, Get, Res, Head } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { SkipThrottle } from '../../common/decorators/skip-throttle.decorator';

@Controller()
export class RootController {
  @Get()
  @SkipThrottle()
  @Public()
  root() {
    return {
      message: 'Core Bridge POS API Gateway',
      version: '1.0',
      docs: '/api/docs',
      health: '/health',
    };
  }

  @Head('favicon.ico')
  @SkipThrottle()
  @Public()
  faviconHead(@Res() res: Response) {
    res.status(204).send();
  }

  @Get('favicon.ico')
  @SkipThrottle()
  @Public()
  favicon(@Res() res: Response) {
    // Return 204 No Content for favicon request
    res.status(204).send();
  }
}
