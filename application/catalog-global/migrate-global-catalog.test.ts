import { describe, expect, it, vi } from "vitest";

import {
  ApprovalTokenError,
  createGlobalCatalogMigration,
  createInMemoryApprovalTokens,
  type LegacyCatalogRecord,
} from "./migrate-global-catalog";

describe("global catalog migration", () => {
  it("builds a read-only report with merges, grants, and isolated conflicts", async () => {
    const apply = vi.fn();
    const migration = createGlobalCatalogMigration({
      legacy: { list: async (): Promise<LegacyCatalogRecord[]> => [
        { organizationId: "org-a", connectionId: "cyber", externalId: "c-1", providerId: "cybermapa", vehicleId: "old-1", plate: "ABC 123", placementFleetId: "fleet-a", capabilities: { gps: "eligible" } },
        { organizationId: "org-b", connectionId: "howen", externalId: "h-1", providerId: "howen", vehicleId: "old-2", plate: "ABC-123", placementFleetId: "fleet-b", capabilities: { video: "eligible" } },
        { organizationId: "org-a", connectionId: "howen", externalId: "h-2", providerId: "howen", vehicleId: "old-3", capabilities: { video: "eligible" } },
      ] },
      target: { listVehicles: async () => [], apply },
      parity: { check: async () => ({ passed: true, gates: ["legacy-count", "grant-count"] }) },
    });

    const report = await migration.dryRun();

    expect(report.writes).toBe(0);
    expect(report.proposedVehicles).toHaveLength(1);
    expect(report.proposedContributions).toHaveLength(2);
    expect(report.proposedGrants).toHaveLength(2);
    expect(report.conflicts).toEqual([{ connectionId: "howen", externalId: "h-2", reason: "missing-plate" }]);
    expect(apply).not.toHaveBeenCalled();
  });

  it("blocks apply without approval, rejects invalid or reused tokens, and applies only after parity", async () => {
    const apply = vi.fn();
    const tokens = createInMemoryApprovalTokens();
    const migration = createGlobalCatalogMigration({
      legacy: { list: async (): Promise<LegacyCatalogRecord[]> => [{ organizationId: "org-a", connectionId: "c", externalId: "e", providerId: "p", vehicleId: "old", plate: "ABC123", placementFleetId: "fleet", capabilities: {} }] },
      target: { listVehicles: async () => [], apply },
      approvalTokens: tokens,
      parity: { check: async () => ({ passed: true, gates: ["parity"] }) },
    });

    const report = await migration.dryRun();
    await expect(migration.apply(report, "missing")).rejects.toThrow(ApprovalTokenError);
    const token = await tokens.issue({ reportId: report.reportId, purpose: "global-catalog-migration" });
    await expect(migration.apply(report, token)).resolves.toMatchObject({ applied: true, parity: { passed: true } });
    await expect(migration.apply(report, token)).rejects.toThrow(ApprovalTokenError);
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it("stops before writing when a parity gate fails and preserves legacy data", async () => {
    const apply = vi.fn();
    const migration = createGlobalCatalogMigration({
      legacy: { list: async (): Promise<LegacyCatalogRecord[]> => [{ organizationId: "org-a", connectionId: "c", externalId: "e", providerId: "p", vehicleId: "old", plate: "ABC123", placementFleetId: "fleet", capabilities: {} }] },
      target: { listVehicles: async () => [], apply },
      approvalTokens: createInMemoryApprovalTokens(),
      parity: { check: async () => ({ passed: false, gates: ["legacy-count"], failures: ["legacy-count"] }) },
    });
    const report = await migration.dryRun();
    const token = await (migration.approvalTokens?.issue({ reportId: report.reportId, purpose: "global-catalog-migration" }) as Promise<string>);

    await expect(migration.apply(report, token)).rejects.toThrow("parity");
    expect(apply).not.toHaveBeenCalled();
  });

  it("supports idempotent reapplication through the target port", async () => {
    const applied = new Set<string>();
    const tokens = createInMemoryApprovalTokens();
    const migration = createGlobalCatalogMigration({
      legacy: { list: async (): Promise<LegacyCatalogRecord[]> => [{ organizationId: "org-a", connectionId: "c", externalId: "e", providerId: "p", vehicleId: "old", plate: "ABC123", placementFleetId: "fleet", capabilities: {} }] },
      target: { listVehicles: async () => [], apply: async (plan) => plan.proposedContributions.forEach((item) => applied.add(item.id)) },
      approvalTokens: tokens,
    });
    const report = await migration.dryRun();
    const first = await tokens.issue({ reportId: report.reportId, purpose: "global-catalog-migration" });
    await migration.apply(report, first);
    const second = await tokens.issue({ reportId: report.reportId, purpose: "global-catalog-migration" });
    await migration.apply(report, second);

    expect(applied).toEqual(new Set(["c:e"]));
  });
});
