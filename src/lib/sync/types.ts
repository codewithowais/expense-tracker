/** Collections that participate in cloud sync, in dependency order for apply. */
export const SYNC_COLLECTIONS = [
  "settings",
  "categories",
  "people",
  "savingsGoals",
  "transactions",
  "budgets",
  "debtEntries",
  "savingsContributions",
] as const;

export type SyncCollection = (typeof SYNC_COLLECTIONS)[number];

export interface SyncRecord {
  id: string;
  updatedAt: string;
  deletedAt: string | null;
  doc: Record<string, unknown>;
}

export interface SyncPushGroup {
  collection: SyncCollection;
  records: SyncRecord[];
}

export interface SyncRequest {
  /** ISO timestamp of the client's last successful pull; null on first sync. */
  since: string | null;
  changes: SyncPushGroup[];
}

export interface SyncPulledRecord {
  collection: SyncCollection;
  doc: Record<string, unknown>;
  updatedAt: string;
  deletedAt: string | null;
}

export interface SyncResponse {
  serverTime: string;
  records: SyncPulledRecord[];
}
