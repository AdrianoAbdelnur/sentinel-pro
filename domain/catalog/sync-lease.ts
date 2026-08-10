export type CatalogSyncLease = {
  organizationId: string;
  connectionId: string;
  runId: string;
  leaseUntil: Date;
};

export function isCatalogSyncLeaseExpired(lease: CatalogSyncLease, now: Date): boolean {
  return lease.leaseUntil.getTime() <= now.getTime();
}
