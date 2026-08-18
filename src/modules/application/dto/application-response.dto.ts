import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApplicationType } from './create-application.dto';

export class ApplicationResponseDto {
  @ApiProperty({ description: 'Application ID' })
  id!: string;

  @ApiProperty({ description: 'Application code' })
  code!: string;

  @ApiProperty({ description: 'Application name' })
  name!: string;

  @ApiProperty({ description: 'Application type', enum: ApplicationType })
  type!: ApplicationType;

  @ApiProperty({ description: 'API Key' })
  apiKey!: string;

  @ApiPropertyOptional({ description: 'Webhook secret' })
  webhookSecret?: string;

  @ApiProperty({ description: 'Is active' })
  isActive!: boolean;

  @ApiPropertyOptional({
    description: 'Allowed IP addresses',
    example: ['192.168.1.1', '10.0.0.1'],
    type: [String],
    isArray: true,
  })
  allowedIps!: string[];

  @ApiProperty({ description: 'Created timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Updated timestamp' })
  updatedAt!: Date;

  constructor(partial: Partial<ApplicationResponseDto>) {
    Object.assign(this, partial);
  }
}

export class CreatedApplicationResponseDto {
  @ApiProperty({ description: 'Application ID' })
  id!: string;

  @ApiProperty({ description: 'Application code' })
  code!: string;

  @ApiProperty({ description: 'Application name' })
  name!: string;

  @ApiProperty({ description: 'Application type', enum: ApplicationType })
  type!: ApplicationType;

  @ApiProperty({ description: 'API Key' })
  apiKey!: string;

  @ApiPropertyOptional({ description: 'Webhook secret' })
  webhookSecret?: string;

  @ApiProperty({ description: 'Is active' })
  isActive!: boolean;

  @ApiPropertyOptional({
    description: 'Allowed IP addresses',
    example: ['192.168.1.1', '10.0.0.1'],
    type: [String],
    isArray: true,
  })
  allowedIps!: string[];

  @ApiProperty({ description: 'Created timestamp' })
  createdAt!: Date;

  constructor(partial: Partial<CreatedApplicationResponseDto>) {
    Object.assign(this, partial);
  }
}
