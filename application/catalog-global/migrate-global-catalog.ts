import { createHash, randomUUID } from "node:crypto";

import { normalizePlate } from "@/domain/catalog/matching";

export type LegacyCatalogRecord = {
  organizationId: string;
  connectionId: string;
  externalId: string;
  providerId: string;
  vehicleId: string;
  presence?: "present" | "absent";
  plate?: string;
  placementFleetId?: string;
  capabilities: Record<string, "eligible" | "absent" | "unsupported" | "stale" | "unavailable">;
  externalFleetId?: string;
  fleetLabel?: string;
};

export type GlobalCatalogMigrationPlan = {
  reportId: string;
  createdAt: Date;
  proposedVehicles: Array<{ id: string; normalizedPlate: string; plate: string; placementFleetId: string }>;
  proposedContributions: Array<{ id: string; connectionId: string; externalId: string; vehicleId: string; capabilities: LegacyCatalogRecord["capabilities"]; presence: "present" | "absent" }>;
  proposedMemberships: Array<{ connectionId: string; externalFleetId: string; vehicleId: string; label: string }>;
  proposedGrants: Array<{ organizationId: string; vehicleId: string }>;
  conflicts: Array<{ connectionId: string; externalId: string; reason: MigrationConflictReason }>;
  parity: MigrationParityResult;
  writes: 0;
};

export type MigrationConflictReason = "missing-plate" | "malformed-plate" | "ambiguous-match" | "conflicting-identity";
export type MigrationParityResult = { passed: boolean; gates: string[]; failures?: string[] };

export type GlobalCatalogMigrationTarget = {
  listVehicles(): Promise<Array<{ id: string; normalizedPlate: string; plate: string; placementFleetId: string }>>;
  apply(plan: GlobalCatalogMigrationPlan): Promise<void>;
};

export type ApprovalTokenClaims = { reportId: string; purpose: "global-catalog-migration" };
export type ApprovalTokenPort = {
  issue(claims: ApprovalTokenClaims): Promise<string>;
  consume(token: string, claims: ApprovalTokenClaims): Promise<void>;
};

export class ApprovalTokenError extends Error {
  constructor(message = "Invalid or already-used approval token") {
    super(message);
    this.name = "ApprovalTokenError";
  }
}

type StoredToken = { digest: string; claims: ApprovalTokenClaims; used: boolean };

export function createInMemoryApprovalTokens(options: { reportId?: string } = {}): ApprovalTokenPort {
  const tokens = new Map<string, StoredToken>();
  return {
    async issue(claims) {
      if (options.reportId !== undefined && options.reportId !== claims.reportId) throw new ApprovalTokenError("Approval token report mismatch");
      const token = randomUUID();
      tokens.set(token, { digest: digest(token), claims, used: false });
      return token;
    },
    async consume(token, claims) {
      const stored = tokens.get(token);
      if (!stored || stored.used || stored.digest !== digest(token) || stored.claims.reportId !== claims.reportId || stored.claims.purpose !== claims.purpose) throw new ApprovalTokenError();
      stored.used = true;
    },
  };
}

function digest(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type GlobalCatalogMigration = {
  dryRun(): Promise<GlobalCatalogMigrationPlan>;
  apply(plan: GlobalCatalogMigrationPlan, token: string): Promise<{ applied: true; parity: MigrationParityResult }>;
  approvalTokens: ApprovalTokenPort;
};

export function createGlobalCatalogMigration(input: {
  legacy: { list(): Promise<LegacyCatalogRecord[]> };
  target: GlobalCatalogMigrationTarget;
  approvalTokens?: ApprovalTokenPort;
  parity?: { check(plan: GlobalCatalogMigrationPlan): Promise<MigrationParityResult> };
  now?: () => Date;
}): GlobalCatalogMigration {
  const approvalTokens = input.approvalTokens ?? createInMemoryApprovalTokens();
  const now = input.now ?? (() => new Date());

  async function dryRun(): Promise<GlobalCatalogMigrationPlan> {
    const records = await input.legacy.list();
    const existingVehicles = await input.target.listVehicles();
    const byPlate = new Map(existingVehicles.map((vehicle) => [vehicle.normalizedPlate, vehicle]));
    const proposedVehicles = new Map<string, GlobalCatalogMigrationPlan["proposedVehicles"][number]>();
    const contributions: GlobalCatalogMigrationPlan["proposedContributions"] = [];
    const memberships: GlobalCatalogMigrationPlan["proposedMemberships"] = [];
    const grants = new Map<string, GlobalCatalogMigrationPlan["proposedGrants"][number]>();
    const conflicts: GlobalCatalogMigrationPlan["conflicts"] = [];
    const identityPlates = new Map<string, string>();
    const plateOwners = new Map<string, Set<string>>();

    for (const record of records) {
      const identityKey = `${record.connectionId}:${record.externalId}`;
      const normalized = record.plate === undefined ? "" : normalizePlate(record.plate);
      if (identityPlates.has(identityKey) && identityPlates.get(identityKey) !== normalized) {
        conflicts.push({ connectionId: record.connectionId, externalId: record.externalId, reason: "conflicting-identity" });
        continue;
      }
      identityPlates.set(identityKey, normalized);
      if (normalized === "") {
        conflicts.push({ connectionId: record.connectionId, externalId: record.externalId, reason: "missing-plate" });
        continue;
      }
      if (!/^[A-Z0-9]{2,}$/.test(normalized)) {
        conflicts.push({ connectionId: record.connectionId, externalId: record.externalId, reason: "malformed-plate" });
        continue;
      }
      const owners = plateOwners.get(normalized) ?? new Set<string>();
      owners.add(`${record.providerId}:${record.vehicleId}`);
      plateOwners.set(normalized, owners);
      if (owners.size > 1 && records.some((candidate) => candidate.providerId === record.providerId && normalizePlate(candidate.plate ?? "") === normalized && candidate.vehicleId !== record.vehicleId)) {
        conflicts.push({ connectionId: record.connectionId, externalId: record.externalId, reason: "ambiguous-match" });
        continue;
      }
      const existing = byPlate.get(normalized);
      const vehicleId = existing?.id ?? `global-${normalized.toLowerCase()}`;
      if (!existing && !proposedVehicles.has(normalized)) proposedVehicles.set(normalized, { id: vehicleId, normalizedPlate: normalized, plate: record.plate ?? normalized, placementFleetId: record.placementFleetId ?? "unassigned" });
      contributions.push({ id: `${record.connectionId}:${record.externalId}`, connectionId: record.connectionId, externalId: record.externalId, vehicleId, capabilities: record.capabilities, presence: record.presence ?? "present" });
      grants.set(`${record.organizationId}:${vehicleId}`, { organizationId: record.organizationId, vehicleId });
      if (record.externalFleetId !== undefined) memberships.push({ connectionId: record.connectionId, externalFleetId: record.externalFleetId, vehicleId, label: record.fleetLabel ?? record.externalFleetId });
    }

    const plan: GlobalCatalogMigrationPlan = { reportId: randomUUID(), createdAt: now(), proposedVehicles: [...proposedVehicles.values()], proposedContributions: contributions, proposedMemberships: memberships, proposedGrants: [...grants.values()], conflicts, parity: { passed: false, gates: [] }, writes: 0 };
    plan.parity = await (input.parity?.check(plan) ?? Promise.resolve({ passed: conflicts.length === 0, gates: ["conflicts-isolated"] }));
    return plan;
  }

  async function apply(plan: GlobalCatalogMigrationPlan, token: string) {
    if (plan.writes !== 0) throw new ApprovalTokenError("Migration report was already applied");
    if (plan.conflicts.length > 0) throw new Error("Cannot apply a migration with conflicts");
    await approvalTokens.consume(token, { reportId: plan.reportId, purpose: "global-catalog-migration" });
    const parity = await (input.parity?.check(plan) ?? Promise.resolve(plan.parity));
    if (!parity.passed) throw new Error(`Migration parity gates failed: ${(parity.failures ?? []).join(", ")}`);
    await input.target.apply(plan);
    return { applied: true as const, parity };
  }

  return { dryRun, apply, approvalTokens };
}
