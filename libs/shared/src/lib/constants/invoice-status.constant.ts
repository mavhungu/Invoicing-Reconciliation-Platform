export const INVOICE_STATUSES = [
  'draft',
  'issued',
  'partially_paid',
  'paid',
  'void',
] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
