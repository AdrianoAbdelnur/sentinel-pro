import { NextResponse } from "next/server";

import { authorizeAdminRequest, readJson } from "@/app/api/admin/users/delivery";

import { getCatalogAdminRuntime } from "../../../composition";
import { alreadyResolved, badRequest, catalogForbidden, parseReviewTarget, toReviewSummary } from "../../../delivery";

type Context = { params: Promise<{ reviewId: string }> };

export async function POST(request: Request, { params }: Context) {
  const actor = await authorizeAdminRequest(request);
  if (actor instanceof NextResponse) return actor;
  const { reviewId } = await params;
  const body = await readJson(request);
  const target = body && parseReviewTarget(body);
  if (!reviewId.trim() || !target) return badRequest();
  const { resolveCatalogReview } = await getCatalogAdminRuntime();
  const result = await resolveCatalogReview({ actor, reviewId, target });
  switch (result.kind) {
    case "resolved": return NextResponse.json({ review: toReviewSummary(result.review) });
    case "already-resolved": return alreadyResolved();
    case "not-found": case "forbidden": return catalogForbidden();
    case "unsupported": return badRequest();
    default: { const neverResult: never = result; return neverResult; }
  }
}
