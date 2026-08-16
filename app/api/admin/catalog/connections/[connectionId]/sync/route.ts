import { NextResponse } from "next/server";

import { authorizeAdminRequest } from "@/app/api/admin/users/delivery";
import { classifyConnectionSourceProblem, resolveConnectionSource, type ConnectionSourceFactories } from "@/app/api/catalog/connection-sources";

import { getCatalogAdminRuntime } from "../../../composition";
import { badRequest, catalogForbidden, missingCompanyAssignment, providerMisconfigured, toSyncOutcomeResponse, unsupportedProvider } from "../../../delivery";

type Context = { params: Promise<{ connectionId: string }> };

export async function POST(request: Request, { params }: Context) {
  const actor = await authorizeAdminRequest(request);
  if (actor instanceof NextResponse) return actor;
  const { connectionId } = await params;
  if (!connectionId.trim()) return badRequest();
  const runtime = await getCatalogAdminRuntime();
  const { connections, synchronizeCatalogConnection } = runtime;
  const registry = "registry" in runtime ? runtime.registry : (runtime as { factories: ConnectionSourceFactories }).factories;
  const connection = await connections.findById(actor.organizationId, connectionId);
  if (!connection) return catalogForbidden();
  const source = resolveConnectionSource(connection, registry);
  if (!source) {
    const problem = classifyConnectionSourceProblem(connection, registry);
    if (problem === "missing-company-assignment") return missingCompanyAssignment();
    if (problem === "misconfigured") return providerMisconfigured();
    return unsupportedProvider();
  }
  const outcome = await synchronizeCatalogConnection({ organizationId: actor.organizationId, connectionId, trigger: "manual", source });
  return toSyncOutcomeResponse(outcome);
}
