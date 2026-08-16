import { createHash, randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import { ApprovalTokenError, createGlobalCatalogMigration, type ApprovalTokenClaims, type ApprovalTokenPort, type GlobalCatalogMigrationPlan, type LegacyCatalogRecord } from "@/application/catalog-global/migrate-global-catalog";
import { createGlobalVehicle } from "@/domain/catalog-global/global-vehicle";
import { createProviderContribution } from "@/domain/catalog-global/provider-contribution";
import { createProviderFleetMembership } from "@/domain/catalog-global/provider-fleet-membership";
import { createTenantVehicleGrant } from "@/domain/catalog-global/tenant-vehicle-grant";

import { getMongoDatabase } from "./client";
import { createGlobalCatalogRepositories } from "./catalog-global-repositories";
import { migrateGlobalCatalogDatabase } from "./catalog-global-migrations";

type LegacyIdentityDocument = { organizationId: string; connectionId: string; externalId: string; vehicleId: string; presence?: "present" | "absent"; capabilityStates?: LegacyCatalogRecord["capabilities"] };
type LegacyVehicleDocument = { id: string; placement?: { fleetId?: string }; plate?: string };

function createMongoApprovalTokens(db: Awaited<ReturnType<typeof getMongoDatabase>>): ApprovalTokenPort {
  const collection = db.collection<{ tokenDigest: string; reportId: string; purpose: string; used: boolean; createdAt: Date }>("catalog_migration_approval_tokens_v2");
  return {
    async issue(claims: ApprovalTokenClaims) {
      const token = randomUUID();
      await collection.insertOne({ tokenDigest: createHash("sha256").update(token).digest("hex"), reportId: claims.reportId, purpose: claims.purpose, used: false, createdAt: new Date() });
      return token;
    },
    async consume(token, claims) {
      const result = await collection.findOneAndUpdate({ tokenDigest: createHash("sha256").update(token).digest("hex"), reportId: claims.reportId, purpose: claims.purpose, used: false }, { $set: { used: true } }, { returnDocument: "before" });
      if (!result) throw new ApprovalTokenError();
    },
  };
}

export async function createMongoGlobalCatalogMigration() {
  const db = await getMongoDatabase();
  const legacy: { list(): Promise<LegacyCatalogRecord[]> } = {
    async list() {
      const identities = await db.collection<LegacyIdentityDocument>("external_vehicle_identities").find({}).sort({ connectionId: 1, externalId: 1 }).toArray();
      const vehicles = new Map((await db.collection<LegacyVehicleDocument>("vehicles").find({}).toArray()).map((vehicle) => [vehicle.id, vehicle]));
      return identities.map((identity) => {
        const vehicle = vehicles.get(identity.vehicleId);
        return { organizationId: identity.organizationId, connectionId: identity.connectionId, externalId: identity.externalId, providerId: identity.connectionId, vehicleId: identity.vehicleId, presence: identity.presence ?? "present", ...(vehicle?.plate !== undefined ? { plate: vehicle.plate } : {}), ...(vehicle?.placement?.fleetId !== undefined ? { placementFleetId: vehicle.placement.fleetId } : {}), capabilities: identity.capabilityStates ?? {} };
      });
    },
  };
  const repositories = createGlobalCatalogRepositories(db);
  const target = {
    async listVehicles() { return (await db.collection("global_vehicles_v2").find({}).sort({ id: 1 }).toArray()).map((vehicle) => ({ id: String(vehicle.id), normalizedPlate: String(vehicle.normalizedPlate), plate: String(vehicle.plate), placementFleetId: String(vehicle.placementFleetId) })); },
    async apply(plan: GlobalCatalogMigrationPlan) {
      await migrateGlobalCatalogDatabase(db);
      for (const vehicle of plan.proposedVehicles) await repositories.vehicles.save(createGlobalVehicle(vehicle));
      for (const contribution of plan.proposedContributions) await repositories.contributions.save(createProviderContribution(contribution));
      for (const membership of plan.proposedMemberships) await repositories.memberships.save(createProviderFleetMembership(membership));
      for (const grant of plan.proposedGrants) await repositories.grants.save(createTenantVehicleGrant(grant));
    },
  };
  return createGlobalCatalogMigration({
    legacy,
    target,
    approvalTokens: createMongoApprovalTokens(db),
    parity: {
      async check(plan) {
        const sourceRecords = await legacy.list();
        const validRecords = sourceRecords.filter((record) => record.plate !== undefined && record.plate.trim() !== "");
        const gates = ["legacy-record-count", "tenant-grant-count", "placement-preservation", "conflicts-isolated"];
        const failures: string[] = [];
        if (plan.proposedContributions.length !== validRecords.length) failures.push("legacy-record-count");
        if (plan.proposedGrants.length !== new Set(validRecords.map((record) => `${record.organizationId}:${record.vehicleId}`)).size) failures.push("tenant-grant-count");
        if (plan.proposedVehicles.some((vehicle) => vehicle.placementFleetId === "unassigned")) failures.push("placement-preservation");
        if (plan.conflicts.length > 0) failures.push("conflicts-isolated");
        return { passed: failures.length === 0, gates, ...(failures.length > 0 ? { failures } : {}) };
      },
    },
  });
}

export async function runGlobalCatalogMigrationCli(args = process.argv.slice(2)): Promise<GlobalCatalogMigrationPlan | { applied: true }> {
  const migration = await createMongoGlobalCatalogMigration();
  const report = await migration.dryRun();
  const reportPath = args.find((arg) => arg.startsWith("--report="))?.slice("--report=".length);
  if (reportPath) await writeFile(reportPath, JSON.stringify(report, null, 2));
  const token = args.find((arg) => arg.startsWith("--apply="))?.slice("--apply=".length);
  if (args.includes("--issue-approval")) {
    if (!args.includes("--approved-by=super-admin")) throw new Error("SUPER ADMIN approval is required");
    const approval = await migration.approvalTokens.issue({ reportId: report.reportId, purpose: "global-catalog-migration" });
    process.stdout.write(`${JSON.stringify({ reportId: report.reportId, approvalToken: approval })}\n`);
    return report;
  }
  if (!token) {
    process.stdout.write(`${JSON.stringify(report)}\n`);
    return report;
  }
  if (!args.includes("--approved-by=super-admin")) throw new Error("SUPER ADMIN approval is required");
  const reportInput = args.find((arg) => arg.startsWith("--report-input="))?.slice("--report-input=".length);
  const approvedReport = reportInput ? JSON.parse(await readFile(reportInput, "utf8")) as GlobalCatalogMigrationPlan : report;
  const result = await migration.apply(approvedReport, token);
  process.stdout.write(`${JSON.stringify(result)}\n`);
  return result;
}

if (process.argv[1]?.endsWith("catalog-migrate-global.ts")) await runGlobalCatalogMigrationCli();
