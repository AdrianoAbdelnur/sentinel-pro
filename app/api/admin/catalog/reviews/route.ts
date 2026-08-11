import { NextResponse } from "next/server";

import { authorizeAdminRequest } from "@/app/api/admin/users/delivery";

import { getCatalogAdminRuntime } from "../composition";
import { catalogForbidden, toReviewSummary } from "../delivery";

export async function GET(request: Request) {
  const actor = await authorizeAdminRequest(request);
  if (actor instanceof NextResponse) return actor;
  const { listPendingCatalogReviews } = await getCatalogAdminRuntime();
  const result = await listPendingCatalogReviews({ actor });
  if (result.kind === "forbidden") return catalogForbidden();
  return NextResponse.json({ reviews: result.reviews.map(toReviewSummary) });
}
