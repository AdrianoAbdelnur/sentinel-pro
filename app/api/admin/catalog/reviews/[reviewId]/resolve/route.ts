import { NextResponse } from "next/server";

import { authorizePlatformRequest, readJson } from "@/app/api/admin/users/delivery";
import { getCatalogSyncRuntime } from "@/app/api/internal/catalog/composition";

import { alreadyResolved, toCanonicalReviewSummary } from "../../../canonical-delivery";
import { badRequest, forbidden } from "@/app/api/internal/catalog/delivery";

type Context = { params: Promise<{ reviewId: string }> };

export async function POST(request: Request, { params }: Context) {
  const actor = await authorizePlatformRequest(request);
  if (actor instanceof NextResponse) return actor;
  const { reviewId } = await params;
  const body = await readJson(request);
  const targetId = typeof body?.targetId === "string" ? body.targetId.trim() : "";
  if (!reviewId.trim() || !targetId) return badRequest();
  const result = await (await getCatalogSyncRuntime()).resolveReview(reviewId, targetId);
  switch (result.kind) {
    case "resolved": return NextResponse.json({ review: toCanonicalReviewSummary(result.review) });
    case "already-resolved": return alreadyResolved();
    case "not-found": return forbidden();
    default: { const neverResult: never = result; return neverResult; }
  }
}
