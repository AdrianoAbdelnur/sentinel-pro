import { describe, expect, it, vi } from "vitest";
import { createProviderImportApplication } from "./import-provider";

const candidate = { externalId: "v-1", companyLabel: "Acme", registeredPlate: "ABC123" };
const source = { loadCompleteSnapshot: vi.fn(async () => ({ kind: "complete" as const, candidates: [candidate] })) };

describe("provider import", () => {
  it("creates a discovered company and synchronizes its candidates", async () => {
    const companies = new Map<string, any>();
    const savedConnections: any[] = [];
    const importProvider = createProviderImportApplication({
      companies: { listByOrganization: async () => [...companies.values()], findById: async (id) => companies.get(id), save: async (company) => { companies.set(company.id, company); } },
      fleets: { findById: async () => undefined, listByCompany: async () => [], save: vi.fn() },
      connections: { findById: async () => undefined, listAll: async () => savedConnections, save: async (connection) => { savedConnections.push(connection); } },
      ids: { create: vi.fn().mockReturnValueOnce("company-1").mockReturnValueOnce("fleet-1").mockReturnValueOnce("connection-1") },
      loadSource: vi.fn(async () => source),
      synchronize: vi.fn(async () => ({ kind: "succeeded" as const, run: { counts: { processed: 1, created: 1, linked: 0, reviewed: 0, rejected: 0, absent: 0 } } as any })),
    });
    const result = await importProvider({ organizationId: "org-1", provider: "cybermapa" });
    expect(result).toMatchObject({ status: "succeeded", companies: 1, fleets: 1, counts: { created: 1 } });
    expect(savedConnections[0].authorizedExternalCompanyLabels).toEqual(["acme"]);
  });
});
