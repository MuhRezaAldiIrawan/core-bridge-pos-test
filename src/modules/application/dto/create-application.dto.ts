import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsUrl,
  MinLength,
  MaxLength,
  IsArray,
  ArrayNotEmpty,
  IsIP,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ApplicationType {
  REQUESTER = 'REQUESTER',
  PROCESSOR = 'PROCESSOR',
}

export class CreateApplicationDto {
  @ApiProperty({ description: 'Application code', example: 'HST001' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(20, { message: 'Code must not exceed 20 characters' })
  code!: string;

  @ApiProperty({ description: 'Application name', example: 'HST Backend' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  name!: string;

  @ApiProperty({ description: 'Application type', enum: ApplicationType })
  @IsEnum(ApplicationType)
  type!: ApplicationType;

  @ApiProperty({ description: 'API Key (min 32 characters)' })
  @IsString()
  @IsNotEmpty()
  @MinLength(32, { message: 'API Key must be at least 32 characters' })
  apiKey!: string;

  @ApiPropertyOptional({ description: 'Webhook secret for HMAC signature' })
  @IsOptional()
  @IsString()
  webhookSecret?: string;

  @ApiPropertyOptional({ description: 'Webhook URL for callbacks' })
  @IsOptional()
  @IsUrl()
  webhookUrl?: string;

  @ApiPropertyOptional({
    description: 'Allowed IP addresses (IPv4/IPv6)',
    example: ['192.168.1.1', '10.0.0.1', '::1'],
    type: [String],
    isArray: true,
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayNotEmpty({ message: 'At least one IP address is required' })
  @IsIP(undefined, { each: true, message: 'Invalid IP address format' })
  allowedIps?: string[];
}
