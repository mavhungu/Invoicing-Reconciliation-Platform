import type { Money } from '../types/money.type';

export interface PaymentAllocationDto {
  invoiceId: string;
  amount: Money;
}

export interface CreatePaymentDto {
  receivedAt: string;
  reference?: string;
  amount: Money;
  allocations: PaymentAllocationDto[];
}

export interface PaymentDto {
  id: string;
  receivedAt: string;
  reference?: string;
  amount: Money;
  allocations: PaymentAllocationDto[];
}
