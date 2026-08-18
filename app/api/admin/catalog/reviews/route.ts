import { NextResponse } from "next/server";

import { authorizePlatformRequest } from "@/app/api/admin/users/delivery";
import { getCatalogSyncRuntime } from "@/app/api/internal/catalog/composition";

import { toCanonicalReviewSummary } from "../canonical-delivery";

export async function GET(request: Request) {
  const actor = await authorizePlatformRequest(request);
  if (actor instanceof NextResponse) return actor;
  const reviews = await (await getCatalogSyncRuntime()).listPendingReviews();
  return NextResponse.json({ reviews: reviews.map(toCanonicalReviewSummary) });
}
