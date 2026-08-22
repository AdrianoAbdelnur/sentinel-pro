import { NextResponse } from "next/server";

import { getPageAuthorization } from "@/app/authorization";
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
  const state = projectCatalogGroupVehicles(group, vehicles);

  return NextResponse.json(state);
}
