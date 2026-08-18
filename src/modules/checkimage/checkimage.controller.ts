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
import { CheckimageService } from './checkimage.service';
import { CheckimageRequestDto } from './dto/checkimage-request.dto';
import { CheckimageResponseDto } from './dto/checkimage-response.dto';
import { APPLICATION_KEY } from '../../common/decorators/current-application.decorator';
import { ApplicationContext } from '../../common/guards/api-key.guard';

@ApiTags('access')
@Controller('api/v1/access')
export class CheckimageController {
  constructor(private readonly checkimageService: CheckimageService) {}

  @Post('checkimage')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Sync/update member image to Wristpay' })
  @ApiBearerAuth('X-API-Key')
  @ApiResponse({
    status: 202,
    description: 'Checkimage request accepted',
    type: CheckimageResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Invalid API key' })
  @ApiResponse({ status: 403, description: 'IP address not allowed' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({ status: 503, description: 'Service unavailable' })
  async checkimage(
    @Body() dto: CheckimageRequestDto,
    @Req() request: Request,
  ): Promise<CheckimageResponseDto> {
    const application = request[APPLICATION_KEY] as ApplicationContext;

    return this.checkimageService.createCheckimage(dto, application.id);
  }
}
