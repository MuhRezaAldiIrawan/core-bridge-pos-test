import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';

export class CreateTransactionDto {
  @IsString()
  @IsNotEmpty()
  type!: 'CHECK_IN' | 'CHECK_IMAGE';

  @IsString()
  @IsNotEmpty()
  correlationId!: string;

  @IsString()
  @IsNotEmpty()
  processorCode!: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @IsString()
  @IsNotEmpty()
  webhookUrl!: string;

  @IsString()
  @IsNotEmpty()
  applicationId!: string;

  @IsOptional()
  @IsString()
  venueId?: string;
}
