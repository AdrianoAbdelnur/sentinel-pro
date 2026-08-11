import { describe, expect, it, vi } from "vitest";

import type { Company, ProviderConnection } from "@/domain/catalog";

import { createAssignConnectionCompanyApplication } from "./assign-connection-company";
import type { AssignConnectionCompanyPorts } from "./ports";

function createFixture() {
  const companies = new Map<string, Company>();
  const connections = new Map<string, ProviderConnection>();
  const saveSpy = vi.fn(async (connection: ProviderConnection) => { connections.set(connection.id, connection); });
  const ports: AssignConnectionCompanyPorts = {
    companies: { findById: async (id) => companies.get(id), save: async (company) => { companies.set(company.id, company); } },
    connections: {
      findById: async (organizationId, id) => { const found = connections.get(id); return found && found.organizationId === organizationId ? found : undefined; },
      listAll: async () => [...connections.values()],
      save: saveSpy,
    },
  };
  return { assign: createAssignConnectionCompanyApplication(ports), connections, companies, saveSpy };
}

const admin = { userId: "admin-1", organizationId: "org-a", role: "admin" as const };
const operator = { userId: "operator-1", organizationId: "org-a", role: "operator" as const };
const otherTenantAdmin = { userId: "admin-2", organizationId: "org-b", role: "admin" as const };

const connectionA: ProviderConnection = { id: "conn-a", organizationId: "org-a", credentialRef: "vault:howen/org-a" };
const companyA: Company = { id: "company-a", organizationId: "org-a", name: "Acme" };
const companyB: Company = { id: "company-b", organizationId: "org-b", name: "Globex" };

describe("provider connection company assignment", () => {
  it("lets a fresh admin assign a legitimate Company to a connection in their own tenant", async () => {
    const fixture = createFixture();
    fixture.connections.set(connectionA.id, connectionA);
    fixture.companies.set(companyA.id, companyA);

    const result = await fixture.assign.assignConnectionCompany({ actor: admin, connectionId: connectionA.id, companyId: companyA.id });

    expect(result).toEqual({ kind: "assigned", connection: { ...connectionA, companyId: companyA.id } });
    expect(fixture.saveSpy).toHaveBeenCalledTimes(1);
  });

  it("rejects an operator, leaving the connection unassigned", async () => {
    const fixture = createFixture();
    fixture.connections.set(connectionA.id, connectionA);
    fixture.companies.set(companyA.id, companyA);

    await expect(fixture.assign.assignConnectionCompany({ actor: operator, connectionId: connectionA.id, companyId: companyA.id })).resolves.toEqual({ kind: "forbidden" });

    expect(fixture.saveSpy).not.toHaveBeenCalled();
  });

  it("rejects another tenant's administrator, since the connection is not theirs", async () => {
    const fixture = createFixture();
    fixture.connections.set(connectionA.id, connectionA);
    fixture.companies.set(companyA.id, companyA);

    await expect(fixture.assign.assignConnectionCompany({ actor: otherTenantAdmin, connectionId: connectionA.id, companyId: companyA.id })).resolves.toEqual({ kind: "forbidden" });

    expect(fixture.saveSpy).not.toHaveBeenCalled();
  });

  it("rejects a fresh admin assigning a Company that legitimately belongs to another tenant", async () => {
    const fixture = createFixture();
    fixture.connections.set(connectionA.id, connectionA);
    fixture.companies.set(companyB.id, companyB);

    await expect(fixture.assign.assignConnectionCompany({ actor: admin, connectionId: connectionA.id, companyId: companyB.id })).resolves.toEqual({ kind: "forbidden" });

    expect(fixture.saveSpy).not.toHaveBeenCalled();
  });

  it("rejects a nonexistent connection, never reaching a Company lookup", async () => {
    const fixture = createFixture();
    fixture.companies.set(companyA.id, companyA);
    const findCompanySpy = vi.spyOn(fixture.companies, "get");

    await expect(fixture.assign.assignConnectionCompany({ actor: admin, connectionId: "missing", companyId: companyA.id })).resolves.toEqual({ kind: "forbidden" });

    expect(findCompanySpy).not.toHaveBeenCalled();
    expect(fixture.saveSpy).not.toHaveBeenCalled();
  });

  it("rejects a nonexistent Company, leaving the connection unassigned", async () => {
    const fixture = createFixture();
    fixture.connections.set(connectionA.id, connectionA);

    await expect(fixture.assign.assignConnectionCompany({ actor: admin, connectionId: connectionA.id, companyId: "missing" })).resolves.toEqual({ kind: "forbidden" });

    expect(fixture.saveSpy).not.toHaveBeenCalled();
  });
});
