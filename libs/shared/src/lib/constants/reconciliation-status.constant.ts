export const RECONCILIATION_STATUSES = [
  'unmatched',
  'suggested',
  'matched',
  'ignored',
] as const;

export type ReconciliationStatus = (typeof RECONCILIATION_STATUSES)[number];
