import {
  Injectable,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { Application } from '@prisma/client';
import {
  CreateApplicationDto,
  ApplicationType,
} from './dto/create-application.dto';

const APP_TTL = 300; // 5 minutes

@Injectable()
export class ApplicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async create(dto: CreateApplicationDto): Promise<Application> {
    // Sanitize code (uppercase, alphanumeric only)
    const sanitizedCode = dto.code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

    // Check for duplicate code
    const existingByCode = await this.prisma.application.findUnique({
      where: { code: sanitizedCode },
    });
    if (existingByCode) {
      throw new ConflictException(
        `Application with code '${sanitizedCode}' already exists`,
      );
    }

    // Check for duplicate API key
    const existingByApiKey = await this.prisma.application.findUnique({
      where: { apiKey: dto.apiKey },
    });
    if (existingByApiKey) {
      throw new ConflictException(
        'Application with this API key already exists',
      );
    }

    // Validate processor type has webhookSecret
    if (dto.type === ApplicationType.PROCESSOR && !dto.webhookSecret) {
      throw new UnprocessableEntityException(
        'Processor type requires webhookSecret',
      );
    }

    // Create application
    const application = await this.prisma.application.create({
      data: {
        code: sanitizedCode,
        name: dto.name,
        type: dto.type,
        apiKey: dto.apiKey,
        webhookSecret: dto.webhookSecret,
        isActive: true,
      },
    });

    return application;
  }

  async findByApiKey(apiKey: string): Promise<Application | null> {
    return this.cache.getOrSet(
      `app:apikey:${apiKey}`,
      () =>
        this.prisma.application.findFirst({
          where: { apiKey, isActive: true },
        }),
      APP_TTL,
    );
  }

  async findByCode(code: string): Promise<Application | null> {
    return this.cache.getOrSet(
      `app:code:${code}`,
      () => this.prisma.application.findUnique({ where: { code } }),
      APP_TTL,
    );
  }
}
