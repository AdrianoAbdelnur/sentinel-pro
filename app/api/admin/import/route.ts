import { NextResponse } from "next/server";
import { authorizeAdminRequest, readJson } from "@/app/api/admin/users/delivery";
import { getProviderImportRuntime } from "./composition";
import type { ProviderImportProgress } from "@/application/catalog";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const actor = await authorizeAdminRequest(request);
  if (actor instanceof NextResponse) return actor;
  const body = await readJson(request);
  if (!body || (body.provider !== "cybermapa" && body.provider !== "howen")) return NextResponse.json({ error: "Elegí una plataforma válida." }, { status: 400 });
  const provider = body.provider as "cybermapa" | "howen";
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      void (async () => {
        try {
          send({ type: "progress", data: { phase: "loading", found: { companies: 0, fleets: 0, vehicles: 0 }, total: 0, processed: 0, counts: { processed: 0, created: 0, linked: 0, reviewed: 0, rejected: 0, absent: 0 } } satisfies ProviderImportProgress });
          const importProvider = await getProviderImportRuntime();
          const result = await importProvider({
            organizationId: actor.organizationId,
            provider,
            onProgress: async (progress: ProviderImportProgress) => send({ type: "progress", data: progress }),
          });
          send({ type: "result", data: result });
        } catch {
          send({ type: "result", data: { provider, status: "failed", code: "provider-failure" } });
        } finally {
          controller.close();
        }
      })();
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-cache, no-transform" } });
}
