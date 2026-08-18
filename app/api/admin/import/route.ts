import { NextResponse } from "next/server";
import { authorizePlatformRequest, readJson } from "@/app/api/admin/users/delivery";
import { getProviderImportRuntime } from "./composition";
import type { GlobalSyncOutcome, GlobalSyncProgress } from "@/application/catalog/synchronize-global-connection";

export const runtime = "nodejs";

function runProgress(run: Extract<GlobalSyncOutcome, { kind: "succeeded" | "failed" }>['run']): GlobalSyncProgress {
  return { connectionId: run.connectionId, lineageId: run.lineageId, runId: run.id, total: run.total, ...(run.checkpoint ? { checkpoint: run.checkpoint } : {}), counts: run.counts };
}

function resultEvent(outcome: GlobalSyncOutcome) {
  if (outcome.kind === "succeeded") return { type: "result", data: { status: "succeeded", provider: outcome.run.connectionId, counts: outcome.run.counts, total: outcome.run.total } };
  if (outcome.kind === "failed") return { type: "result", data: { status: "failed", provider: outcome.run.connectionId, code: outcome.failure.category } };
  return { type: "result", data: { status: outcome.kind, provider: "global" } };
}

export async function POST(request: Request) {
  const actor = await authorizePlatformRequest(request);
  if (actor instanceof NextResponse) return actor;
  const body = await readJson(request);
  if (!body || (body.provider !== "cybermapa" && body.provider !== "howen")) return NextResponse.json({ error: "Invalid provider." }, { status: 400 });
  const provider = body.provider as "cybermapa" | "howen";
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      let detached = request.signal.aborted;
      let finished = false;
      const send = (event: unknown) => {
        if (detached || finished) return;
        try { controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`)); } catch { detached = true; }
      };
      const finish = () => {
        if (finished) return;
        finished = true;
        try { controller.close(); } catch { detached = true; }
      };
      const detach = () => { detached = true; };
      request.signal.addEventListener("abort", detach, { once: true });
      const execute = async () => {
        try {
          send({ type: "progress", data: { phase: "loading", total: 0, processed: 0, counts: { processed: 0, created: 0, linked: 0, reviewed: 0, rejected: 0, absent: 0 } } });
          const runtime = await getProviderImportRuntime();
          const definition = await runtime.providers.findByAdapterKey(provider);
          if (!definition) throw new Error("provider unavailable");
          const connection = await runtime.connections.findEnabledByProviderId(definition.id);
          if (!connection) throw new Error("provider connection unavailable");
          const source = runtime.sources.resolve(connection, definition);
          if (!source) throw new Error("provider source unavailable");
          const outcome = await runtime.synchronize({ connectionId: connection.id, trigger: "manual", source, onProgress: (progress) => send({ type: "progress", data: progress }) });
          if (outcome.kind === "succeeded" || outcome.kind === "failed") send({ type: "progress", data: runProgress(outcome.run) });
          send(resultEvent(outcome));
        } catch {
          send({ type: "result", data: { provider, status: "failed", code: "provider-failure" } });
        } finally {
          request.signal.removeEventListener("abort", detach);
          finish();
        }
      };
      void execute().catch(() => finish());
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-cache, no-transform" } });
}
