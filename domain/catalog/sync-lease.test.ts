import { describe, expect, it } from "vitest";

import { isCatalogSyncLeaseExpired } from "./sync-lease";

describe("catalog sync lease expiry", () => {
  it("treats a lease as expired once the injected clock reaches its leaseUntil, and as still held just before it", () => {
    const lease = { organizationId: "org-a", connectionId: "conn-cyber", runId: "run-1", leaseUntil: new Date("2026-01-01T00:10:00Z") };

    expect(isCatalogSyncLeaseExpired(lease, new Date("2026-01-01T00:09:59Z"))).toBe(false);
    expect(isCatalogSyncLeaseExpired(lease, new Date("2026-01-01T00:10:00Z"))).toBe(true);
    expect(isCatalogSyncLeaseExpired(lease, new Date("2026-01-01T00:10:01Z"))).toBe(true);
  });
});
