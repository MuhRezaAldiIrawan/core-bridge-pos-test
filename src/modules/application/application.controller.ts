import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApplicationService } from './application.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import {
  ApplicationResponseDto,
  CreatedApplicationResponseDto,
} from './dto/application-response.dto';
import { Public } from '../../common/decorators/public.decorator';

@Controller({
  path: 'api/v1/applications',
  version: '1',
})
export class ApplicationController {
  constructor(private readonly applicationService: ApplicationService) {}

  @Post()
  @Public() // Public for initial setup - restrict in production
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createApplicationDto: CreateApplicationDto,
  ): Promise<CreatedApplicationResponseDto> {
    const application =
      await this.applicationService.create(createApplicationDto);

    return new CreatedApplicationResponseDto({
      id: application.id,
      code: application.code,
      name: application.name,
      type: application.type as ApplicationResponseDto['type'],
      apiKey: application.apiKey,
      webhookSecret: application.webhookSecret ?? undefined,
      isActive: application.isActive,
      createdAt: application.createdAt,
    });
  }
}
