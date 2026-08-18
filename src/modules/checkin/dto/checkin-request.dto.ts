import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsUrl,
  IsOptional,
  IsNumber,
  IsPositive,
} from 'class-validator';

export class CheckinRequestDto {
  @ApiProperty({ description: 'Member ID from HST system', example: 'MBR001' })
  @IsString()
  @IsNotEmpty()
  member_uid: string;

  @ApiProperty({ description: 'Member name', example: 'Budi Santoso' })
  @IsString()
  @IsNotEmpty()
  member_name: string;

  @ApiProperty({
    description: 'Profile photo URL',
    example: 'https://example.com/photo.jpg',
  })
  @IsUrl()
  @IsNotEmpty()
  image_url: string;

  @ApiPropertyOptional({ description: 'Phone number', example: '081234567890' })
  @IsString()
  @IsOptional()
  phone_number?: string;

  @ApiPropertyOptional({
    description: 'Email address',
    example: 'budi@example.com',
  })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiProperty({ description: 'Venue/location identifier', example: '2' })
  @IsString()
  @IsNotEmpty()
  venue_id: string;

  @ApiProperty({ description: 'Site code for routing', example: 'JKT' })
  @IsString()
  @IsNotEmpty()
  site_code: string;

  @ApiProperty({ description: 'Access level assigned', example: 'LVL001' })
  @IsString()
  @IsNotEmpty()
  access_level_uid: string;

  @ApiProperty({ description: 'Highest level product ID', example: 2 })
  @IsNumber()
  @IsPositive()
  product_id: number;

  @ApiProperty({ description: 'Product name', example: '3 day pass' })
  @IsString()
  @IsNotEmpty()
  product_name: string;

  @ApiProperty({
    description: 'Product type',
    example: 'membership',
    enum: ['membership', 'package', 'class'],
  })
  @IsString()
  @IsNotEmpty()
  product_type: string;

  @ApiProperty({
    description: 'HST callback URL for webhook',
    example: 'https://hst-backend.example.com/webhook',
  })
  @IsUrl()
  @IsNotEmpty()
  webhook_url: string;

  @ApiProperty({ description: 'Target processor code', example: 'WRP001' })
  @IsString()
  @IsNotEmpty()
  processor_code: string;
}
