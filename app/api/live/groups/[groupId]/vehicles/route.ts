import { NextResponse } from "next/server";

import { getPageAuthorization } from "@/app/authorization";
import { loadLiveSnapshots } from "@/integrations/catalog/live-snapshot-adapters";
import { projectCatalogGroupVehicles } from "@/application/live";
import { getMongoDatabase } from "@/integrations/persistence/mongodb/client";
import { createCatalogRepositories } from "@/integrations/persistence/mongodb/catalog-repositories";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ groupId: string }> };

export async function GET(_request: Request, { params }: Context) {
  const authorization = await getPageAuthorization("operator");
  if (authorization.kind !== "authorized") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { groupId } = await params;
  if (!groupId.trim()) {
    return NextResponse.json({ error: "Invalid group" }, { status: 400 });
  }

  const repositories = createCatalogRepositories(await getMongoDatabase());
  const group = await repositories.groups.findById(groupId);
  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  const vehicles = await repositories.vehicles.listByOrganizationAndGroupId(
    authorization.context.organizationId,
    groupId,
  );
  const contributions = (await Promise.all(vehicles.map((vehicle) => repositories.contributions.listByVehicleId(vehicle.id)))).flat();
  const connectionIds = [...new Set(contributions.map(({ connectionId }) => connectionId))];
  const connections = (await Promise.all(connectionIds.map((id) => repositories.connections.findById(id)))).filter((connection): connection is NonNullable<typeof connection> => connection !== undefined);
  const providerIds = [...new Set(connections.map(({ providerId }) => providerId))];
  const providers = (await Promise.all(providerIds.map((id) => repositories.providers.findById(id)))).filter((provider): provider is NonNullable<typeof provider> => provider !== undefined);
  const [policies, sourceSnapshots] = await Promise.all([
    repositories.policies.list(),
    loadLiveSnapshots(connections, providers, contributions, new Map(vehicles.map((vehicle) => [vehicle.id, vehicle.plate]))),
  ]);
  const state = projectCatalogGroupVehicles(group, vehicles, { contributions, connections, policies, sourceSnapshots });

  return NextResponse.json(state);
}
