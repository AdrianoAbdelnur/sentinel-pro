import { describe, expect, it, vi } from "vitest";
import { createProviderImportApplication } from "./import-provider";
import type { ProviderConnection } from "@/domain/catalog";
import type { CatalogSyncOutcome } from "./sync-contracts";

const candidate = { externalId: "v-1", companyLabel: "Acme", registeredPlate: "ABC123" };
const source = { loadCompleteSnapshot: vi.fn(async () => ({ kind: "complete" as const, candidates: [candidate] })) };

describe("provider import", () => {
  it("creates a discovered company and synchronizes its candidates", async () => {
    const companies = new Map<string, { id: string; organizationId: string; name: string }>();
    const savedConnections: ProviderConnection[] = [];
    const importProvider = createProviderImportApplication({
      companies: { listByOrganization: async () => [...companies.values()], findById: async (id) => companies.get(id), save: async (company) => { companies.set(company.id, company); } },
      fleets: { findById: async () => undefined, listByCompany: async () => [], save: vi.fn() },
      connections: { findById: async () => undefined, listAll: async () => savedConnections, save: async (connection) => { savedConnections.push(connection); } },
      ids: { create: vi.fn().mockReturnValueOnce("company-1").mockReturnValueOnce("fleet-1").mockReturnValueOnce("connection-1") },
      loadSource: vi.fn(async () => source),
      synchronize: vi.fn(async () => ({ kind: "succeeded", run: { id: "run-1", organizationId: "org-1", connectionId: "connection-1", trigger: "manual", status: "succeeded", fullSnapshot: true, startedAt: new Date(), completedAt: new Date(), counts: { processed: 1, created: 1, linked: 0, reviewed: 0, rejected: 0, absent: 0 } } } as CatalogSyncOutcome)),
    });
    const result = await importProvider({ organizationId: "org-1", provider: "cybermapa" });
    expect(result).toMatchObject({ status: "succeeded", companies: 1, fleets: 1, counts: { created: 1 } });
    expect(savedConnections[0].authorizedExternalCompanyLabels).toEqual(["acme"]);
  });

  it("emits found and persistence progress from real application counts", async () => {
    const events: string[] = [];
    const importProvider = createProviderImportApplication({
      companies: { listByOrganization: async () => [], findById: async () => undefined, save: vi.fn() },
      fleets: { findById: async () => undefined, listByCompany: async () => [], save: vi.fn() },
      connections: { findById: async () => undefined, listAll: async () => [], save: vi.fn() },
      ids: { create: vi.fn().mockReturnValueOnce("company-1").mockReturnValueOnce("fleet-1").mockReturnValueOnce("connection-1") },
      loadSource: vi.fn(async () => source),
      synchronize: vi.fn(async ({ onProgress }) => {
        await onProgress?.({ total: 1, processed: 1, counts: { processed: 1, created: 1, linked: 0, reviewed: 0, rejected: 0, absent: 0 } });
        return { kind: "succeeded", run: { id: "run-1", organizationId: "org-1", connectionId: "connection-1", trigger: "manual", status: "succeeded", fullSnapshot: true, startedAt: new Date(), completedAt: new Date(), counts: { processed: 1, created: 1, linked: 0, reviewed: 0, rejected: 0, absent: 0 } } } as CatalogSyncOutcome;
      }),
    });

    const result = await importProvider({ organizationId: "org-1", provider: "cybermapa", onProgress: async (progress) => { events.push(`${progress.phase}:${progress.found.vehicles}:${progress.processed}:${progress.counts.created}`); } });

    expect(events).toEqual(["loading:1:0:0", "saving:1:1:1"]);
    expect(result).toMatchObject({ found: { vehicles: 1, companies: 1 }, counts: { processed: 1, created: 1 } });
  });
});
