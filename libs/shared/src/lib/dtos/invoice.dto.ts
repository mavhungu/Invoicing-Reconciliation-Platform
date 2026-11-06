import type { CurrencyCode } from '../types/currency-code.type';
import type { AmountCents } from '../types/money.type';
import type { VatRateBasisPoints } from '../types/vat-rate.type';
import type { InvoiceStatus } from '../constants/invoice-status.constant';

export interface CreateInvoiceLineDto {
  description: string;
  netAmountCents: AmountCents;
  vatRateBasisPoints: VatRateBasisPoints;
}

export interface CreateInvoiceDto {
  customerId: string;
  currency: CurrencyCode;
  dueDate: string;
  lines: CreateInvoiceLineDto[];
}

export interface InvoiceLineDto {
  id: string;
  description: string;
  currency: CurrencyCode;
  netAmountCents: AmountCents;
  vatRateBasisPoints: VatRateBasisPoints;
  vatAmountCents: AmountCents;
  totalAmountCents: AmountCents;
}

export interface InvoiceDto {
  id: string;
  invoiceNumber: string;
  customerId: string;
  currency: CurrencyCode;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  lines: InvoiceLineDto[];
  netAmountCents: AmountCents;
  vatAmountCents: AmountCents;
  totalAmountCents: AmountCents;
}
