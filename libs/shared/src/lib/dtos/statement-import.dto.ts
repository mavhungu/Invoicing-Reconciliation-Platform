import type { Money } from '../types/money.type';

export interface StatementTransactionImportDto {
  bookedAt: string;
  description: string;
  amount: Money;
  bankReference?: string;
}

export interface ImportStatementDto {
  bankAccountId: string;
  transactions: StatementTransactionImportDto[];
}

export interface StatementTransactionDto extends StatementTransactionImportDto {
  id: string;
  transactionHash: string;
}
