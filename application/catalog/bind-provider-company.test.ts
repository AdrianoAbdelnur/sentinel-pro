import { describe, expect, it } from "vitest";

import type { Company, CompanyCandidate, Fleet, ProviderConnection, Vehicle } from "@/domain/catalog";

import { createCompanyBindingApplication } from "./bind-provider-company";
import { createCatalogApplication } from "./index";
import type { CatalogApplicationPorts, CompanyBindingPorts } from "./ports";

function createFixture() {
  const companies = new Map<string, Company>();
  const fleets = new Map<string, Fleet>();
  const vehicles = new Map<string, Vehicle>();
  const candidates = new Map<string, CompanyCandidate>();
  let sequence = 0;
  const ids = { create: () => `id-${++sequence}` };
  const companyPort = {
    findById: async (id: string) => companies.get(id),
    save: async (company: Company) => { companies.set(company.id, company); },
  };
  const catalogPorts: CatalogApplicationPorts = {
    companies: companyPort,
    fleets: {
      findById: async (id) => fleets.get(id),
      listByCompany: async (companyId) => [...fleets.values()].filter((fleet) => fleet.companyId === companyId),
      save: async (fleet) => { fleets.set(fleet.id, fleet); },
    },
    vehicles: {
      findById: async (id) => vehicles.get(id),
      listByCompany: async (companyId) => [...vehicles.values()].filter((vehicle) => vehicle.companyId === companyId),
      save: async (vehicle) => { vehicles.set(vehicle.id, vehicle); },
    },
    ids,
  };
  const bindingPorts: CompanyBindingPorts = {
    companies: companyPort,
    candidates: {
      findById: async (id) => candidates.get(id),
      findByConnectionAndLabel: async (connectionId, normalizedLabel) =>
        [...candidates.values()].find((candidate) => candidate.connectionId === connectionId && candidate.normalizedLabel === normalizedLabel),
      save: async (candidate) => { candidates.set(candidate.id, candidate); },
    },
    ids,
  };
  return {
    catalog: createCatalogApplication(catalogPorts),
    binding: createCompanyBindingApplication(bindingPorts),
    candidates,
    companies,
  };
}

const admin = { userId: "admin-1", organizationId: "org-a", role: "admin" as const };
const operator = { userId: "operator-1", organizationId: "org-a", role: "operator" as const };
const otherTenantAdmin = { userId: "admin-2", organizationId: "org-b", role: "admin" as const };

const connectionA: ProviderConnection = { id: "conn-a", organizationId: "org-a", credentialRef: "cred-ref-a" };
const connectionB: ProviderConnection = { id: "conn-b", organizationId: "org-a", credentialRef: "cred-ref-b" };

describe("provider company binding", () => {
  it("stages one unbound candidate for an unrecognized company label on a tenant connection", async () => {
    const fixture = createFixture();

    const result = await fixture.binding.stageCompanyCandidate({ connection: connectionA, externalLabel: "Acme Transport" });

    expect(result.kind).toBe("staged");
    if (result.kind !== "staged") throw new Error("expected staged");
    expect(result.candidate.companyId).toBeUndefined();
    expect(fixture.candidates.size).toBe(1);
  });

  it("does not duplicate a candidate when the same normalized label repeats on the same connection", async () => {
    const fixture = createFixture();
    await fixture.binding.stageCompanyCandidate({ connection: connectionA, externalLabel: "Acme Transport" });

    const repeated = await fixture.binding.stageCompanyCandidate({ connection: connectionA, externalLabel: "ACME   TRANSPORT" });

    expect(repeated.kind).toBe("repeated");
    expect(fixture.candidates.size).toBe(1);
  });

  it("keeps separate candidates when two tenant connections report the same normalized label", async () => {
    const fixture = createFixture();

    await fixture.binding.stageCompanyCandidate({ connection: connectionA, externalLabel: "Acme Transport" });
    await fixture.binding.stageCompanyCandidate({ connection: connectionB, externalLabel: "Acme Transport" });

    expect(fixture.candidates.size).toBe(2);
  });

  it("lets an authorized tenant administrator bind a candidate to an existing Company", async () => {
    const fixture = createFixture();
    const company = await fixture.catalog.createCompany({ actor: admin, name: "Acme" });
    if (company.kind !== "created") throw new Error("expected company creation");
    const staged = await fixture.binding.stageCompanyCandidate({ connection: connectionA, externalLabel: "Acme Transport" });
    if (staged.kind !== "staged") throw new Error("expected staged");

    const bound = await fixture.binding.bindProviderCompany({ actor: admin, candidateId: staged.candidate.id, companyId: company.company.id });

    expect(bound).toEqual({ kind: "bound", candidate: { ...staged.candidate, companyId: company.company.id } });
  });

  it("lets an administrator create and bind a new Company without creating any identity organization, user, or membership", async () => {
    const fixture = createFixture();
    const staged = await fixture.binding.stageCompanyCandidate({ connection: connectionA, externalLabel: "Acme Transport" });
    if (staged.kind !== "staged") throw new Error("expected staged");

    const created = await fixture.catalog.createCompany({ actor: admin, name: "Acme Transport" });
    if (created.kind !== "created") throw new Error("expected company creation");
    const bound = await fixture.binding.bindProviderCompany({ actor: admin, candidateId: staged.candidate.id, companyId: created.company.id });

    expect(bound.kind).toBe("bound");
    expect(fixture.companies.get(created.company.id)).toEqual(created.company);
  });

  it("rejects binding from an operator or another tenant's administrator, leaving the candidate and Company unchanged", async () => {
    const fixture = createFixture();
    const company = await fixture.catalog.createCompany({ actor: admin, name: "Acme" });
    if (company.kind !== "created") throw new Error("expected company creation");
    const staged = await fixture.binding.stageCompanyCandidate({ connection: connectionA, externalLabel: "Acme Transport" });
    if (staged.kind !== "staged") throw new Error("expected staged");

    await expect(fixture.binding.bindProviderCompany({ actor: operator, candidateId: staged.candidate.id, companyId: company.company.id })).resolves.toEqual({ kind: "forbidden" });
    await expect(fixture.binding.bindProviderCompany({ actor: otherTenantAdmin, candidateId: staged.candidate.id, companyId: company.company.id })).resolves.toEqual({ kind: "forbidden" });

    expect(fixture.candidates.get(staged.candidate.id)?.companyId).toBeUndefined();
  });
});
