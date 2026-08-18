import { TransactionStatus } from '../dto/update-status.dto';
import { Application, Transaction } from '@prisma/client';

export interface TransactionWithApplication extends Transaction {
  application: Application | null;
}

export interface TransactionResult {
  transaction: Transaction;
  correlationId: string;
}

export type TransactionLogEntry = {
  id: string;
  transactionId: string;
  status: string;
  action: string;
  details: Record<string, unknown>;
  errorCode?: string | null;
  errorMessage?: string | null;
  createdAt: Date;
};

export interface CachedTransaction {
  id: string;
  status: TransactionStatus;
  errorCode?: string | null;
  errorMessage?: string | null;
}
