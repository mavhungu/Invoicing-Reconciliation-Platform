import type { CurrencyCode } from './currency-code.type';

export type AmountCents = number;

export interface Money {
  amountCents: AmountCents;
  currency: CurrencyCode;
}
