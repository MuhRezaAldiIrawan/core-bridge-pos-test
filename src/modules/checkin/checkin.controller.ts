import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CheckinService } from './checkin.service';
import { CheckinRequestDto } from './dto/checkin-request.dto';
import { CheckinResponseDto } from './dto/checkin-response.dto';
import { APPLICATION_KEY } from '../../common/decorators/current-application.decorator';
import { ApplicationContext } from '../../common/guards/api-key.guard';

@ApiTags('access')
@Controller('api/v1/access')
export class CheckinController {
  constructor(private readonly checkinService: CheckinService) {}

  @Post('checkin')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Create gate access for member check-in' })
  @ApiBearerAuth('X-API-Key')
  @ApiResponse({
    status: 202,
    description: 'Check-in request accepted',
    type: CheckinResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Invalid API key' })
  @ApiResponse({ status: 403, description: 'IP address not allowed' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({ status: 503, description: 'Service unavailable' })
  async checkin(
    @Body() dto: CheckinRequestDto,
    @Req() request: Request,
  ): Promise<CheckinResponseDto> {
    const application = request[APPLICATION_KEY] as ApplicationContext;

    return this.checkinService.createCheckin(
      dto,
      application.id,
      application.code,
    );
  }
}
