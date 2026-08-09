import {
  belongsToOrganization,
  bindCandidateToCompany,
  normalizeCompanyLabel,
  stageCandidate,
  type ProviderConnection,
} from "@/domain/catalog";
import type { AuthorizationContext } from "@/application/identity";

import type { BindProviderCompanyResult, StageCompanyCandidateResult } from "./contracts";
import type { CompanyBindingPorts } from "./ports";

export function createCompanyBindingApplication(ports: CompanyBindingPorts) {
  async function stageCompanyCandidate({ connection, externalLabel }: { connection: ProviderConnection; externalLabel: string }): Promise<StageCompanyCandidateResult> {
    const normalizedLabel = normalizeCompanyLabel(externalLabel);
    const existing = await ports.candidates.findByConnectionAndLabel(connection.id, normalizedLabel);
    if (existing) return { kind: "repeated", candidate: existing };
    const candidate = stageCandidate(ports.ids.create(), connection, externalLabel);
    await ports.candidates.save(candidate);
    return { kind: "staged", candidate };
  }

  async function bindProviderCompany({ actor, candidateId, companyId }: { actor: AuthorizationContext; candidateId: string; companyId: string }): Promise<BindProviderCompanyResult> {
    if (actor.role !== "admin") return { kind: "forbidden" };
    const candidate = await ports.candidates.findById(candidateId);
    if (!candidate || candidate.organizationId !== actor.organizationId) return { kind: "forbidden" };
    const company = await ports.companies.findById(companyId);
    if (!company || !belongsToOrganization(company, actor.organizationId)) return { kind: "forbidden" };
    const bound = bindCandidateToCompany(candidate, companyId);
    await ports.candidates.save(bound);
    return { kind: "bound", candidate: bound };
  }

  return { stageCompanyCandidate, bindProviderCompany };
}
