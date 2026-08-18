import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUrl } from 'class-validator';

export class CheckimageRequestDto {
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
