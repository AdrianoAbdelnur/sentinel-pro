import { assignCompanyToConnection, belongsToOrganization } from "@/domain/catalog";
import type { AuthorizationContext } from "@/application/identity";

import type { AssignConnectionCompanyResult } from "./contracts";
import type { AssignConnectionCompanyPorts } from "./ports";

export function createAssignConnectionCompanyApplication(ports: AssignConnectionCompanyPorts) {
  async function assignConnectionCompany({ actor, connectionId, companyId }: { actor: AuthorizationContext; connectionId: string; companyId: string }): Promise<AssignConnectionCompanyResult> {
    if (actor.role !== "admin") return { kind: "forbidden" };
    const connection = await ports.connections.findById(actor.organizationId, connectionId);
    if (!connection) return { kind: "forbidden" };
    const company = await ports.companies.findById(companyId);
    if (!company || !belongsToOrganization(company, actor.organizationId)) return { kind: "forbidden" };
    const assigned = assignCompanyToConnection(connection, companyId);
    await ports.connections.save(assigned);
    return { kind: "assigned", connection: assigned };
  }

  return { assignConnectionCompany };
}
