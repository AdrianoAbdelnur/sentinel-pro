import { NextResponse } from "next/server";

import { getPageAuthorization } from "@/app/authorization";
import { createLoadLivePage } from "@/application/live";
import { loadLiveSnapshots } from "@/integrations/catalog/live-snapshot-adapters";
import { getMongoDatabase } from "@/integrations/persistence/mongodb/client";
import { createCatalogRepositories } from "@/integrations/persistence/mongodb/catalog-repositories";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const authorization = await getPageAuthorization("operator");
  if (authorization.kind !== "authorized") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const query = new URL(request.url).searchParams;
  const page = Number(query.get("page") ?? "1");
  if (!Number.isInteger(page) || page < 1) return NextResponse.json({ error: "Invalid page" }, { status: 400 });
  const plate = query.get("plate")?.trim() || undefined;
  const groupId = query.get("groupId")?.trim() || undefined;
  const repositories = createCatalogRepositories(await getMongoDatabase());
  const result = await createLoadLivePage({ ...repositories, loadSnapshots: loadLiveSnapshots })({ organizationId: authorization.context.organizationId, page, plate, groupId });
  return NextResponse.json(result.state);
}
