import { describe, expect, it } from "vitest";

import { failCatalogSyncRun, startCatalogSyncRun, succeedCatalogSyncRun, type CatalogSyncFailure } from "./sync-run";

describe("catalog sync run lifecycle", () => {
  it("starts an active run scoped to its connection with zero counts and no completion", () => {
    const run = startCatalogSyncRun("run-1", { organizationId: "org-a", connectionId: "conn-cyber", trigger: "initial", fullSnapshot: true }, new Date("2026-01-01T00:00:00Z"));

    expect(run).toEqual({ id: "run-1", organizationId: "org-a", connectionId: "conn-cyber", trigger: "initial", fullSnapshot: true, status: "active", startedAt: new Date("2026-01-01T00:00:00Z"), counts: { processed: 0, created: 0, linked: 0, reviewed: 0, rejected: 0, absent: 0 } });
  });

  it("succeeds a run with its completion time and final counts, without discarding its trigger or full-snapshot flag", () => {
    const started = startCatalogSyncRun("run-1", { organizationId: "org-a", connectionId: "conn-cyber", trigger: "scheduled", fullSnapshot: true }, new Date("2026-01-01T00:00:00Z"));

    const succeeded = succeedCatalogSyncRun(started, new Date("2026-01-01T00:05:00Z"), { processed: 10, created: 2, linked: 5, reviewed: 1, rejected: 0, absent: 2 });

    expect(succeeded).toMatchObject({ status: "succeeded", completedAt: new Date("2026-01-01T00:05:00Z"), counts: { processed: 10, created: 2, linked: 5, reviewed: 1, rejected: 0, absent: 2 }, trigger: "scheduled", fullSnapshot: true });
  });

  it("fails a run by composing its summary only from a fixed category label, a numeric HTTP status, and a short pattern-bounded provider error code", () => {
    const started = startCatalogSyncRun("run-1", { organizationId: "org-a", connectionId: "conn-cyber", trigger: "manual", fullSnapshot: true }, new Date("2026-01-01T00:00:00Z"));

    const failed = failCatalogSyncRun(started, new Date("2026-01-01T00:01:00Z"), { category: "authentication", httpStatus: 401, providerErrorCode: "AUTH_001" });

    expect(failed.status).toBe("failed");
    expect(failed.failureSummary).toBe("Authentication failed - HTTP 401 - code AUTH_001");
  });

  it("drops a provider error code that does not match the short bounded code pattern instead of embedding it, so none of ten realistic raw-text leak shapes ever reach the composed summary", () => {
    const started = startCatalogSyncRun("run-1", { organizationId: "org-a", connectionId: "conn-cyber", trigger: "manual", fullSnapshot: true }, new Date("2026-01-01T00:00:00Z"));
    const leakShapes = [
      "provider rejected request: sk-live-4242424242424242",
      "https://svc-acct:hunter2@cybermapa.example.com/api",
      "mongodb://admin:S3cr3tPass@10.0.0.5:27017/prod",
      "got token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U",
      '{"sessionId":"a1b2c3d4e5f6"}',
      "<ApiKey>sk-live-topsecret9999</ApiKey>",
      "the password hunter2ExtraLong for this account has expired",
      "AUTH-001 leaked with trailing extra unsafe text that is far too long to be a real code",
      "vault:cybermapa/org-a",
      "Bearer sk-live-abc123",
    ];

    for (const shape of leakShapes) {
      const failure: CatalogSyncFailure = { category: "internal", providerErrorCode: shape };
      const failed = failCatalogSyncRun(started, new Date("2026-01-01T00:01:00Z"), failure);
      expect(failed.failureSummary).toBe("Internal synchronization error");
    }
  });
});
