import { ApiProperty } from '@nestjs/swagger';

export class CheckimageResponseDto {
  @ApiProperty({ description: 'Request status', example: 'ACCEPTED' })
  status: string;

  @ApiProperty({
    description: 'Transaction ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  transaction_id: string;

  @ApiProperty({ description: 'Transaction type', example: 'CHECK_IMAGE' })
  transaction_type: string;

  @ApiProperty({
    description: 'Timestamp when queued',
    example: '2026-08-07T09:15:00+07:00',
  })
  queued_at: string;

  constructor(partial: Partial<CheckimageResponseDto>) {
    Object.assign(this, partial);
  }
}
