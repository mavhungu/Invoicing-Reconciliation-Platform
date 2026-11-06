export const ACCOUNT_ROLES = ['owner', 'accountant', 'viewer'] as const;

export type AccountRole = (typeof ACCOUNT_ROLES)[number];
