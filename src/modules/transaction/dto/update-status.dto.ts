import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsInt,
  Min,
} from 'class-validator';

/**
 * Transaction Status berdasarkan pemilik:
 * - PENDING: HST (check-in dicatat, menunggu proses)
 * - PUBLISHED: Core Bridge (pesanan berhasil dipublish)
 * - PROCESSING: Wristband App (sedang diproses)
 * - SUCCESS: Core Bridge, HST (status akhir sukses)
 * - FAILED: Core Bridge, HST (status akhir gagal, perlu manual)
 */
export enum TransactionStatus {
  PENDING = 'PENDING',
  PUBLISHED = 'PUBLISHED',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

export class UpdateStatusDto {
  @IsString()
  @IsNotEmpty()
  transactionId!: string;

  @IsEnum(TransactionStatus)
  status!: TransactionStatus;

  @IsOptional()
  @IsString()
  errorCode?: string;

  @IsOptional()
  @IsString()
  errorMessage?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  retryCount?: number;

  @IsOptional()
  details?: Record<string, unknown>;
}
