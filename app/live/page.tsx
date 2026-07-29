import type { Metadata } from "next";

import { LiveScreen } from "@/components/live/live-screen";
import { inMemoryLiveDataSource } from "@/integrations/live/in-memory/in-memory-live-data-source";

import { readLiveRuntimeConfig } from "./live-runtime-config";

export const metadata: Metadata = {
  title: "Live · Sentinel Pro",
  description: "Operational live monitoring for fleets and vehicles.",
};

// This page uses no request-time API, so without this Next.js would prerender
// it and bake one `nowMs` into the build — every request would then read the
// same "now" until the next deploy, defeating the staleness rule.
export const dynamic = "force-dynamic";

export default function LivePage() {
  const liveState = inMemoryLiveDataSource.readLiveState();
  const tabs = inMemoryLiveDataSource.readBottomPanelTabs();

  // The only process.env read and the only clock read in the live slice. Both
  // are threaded down as plain numbers so hydration cannot disagree with the
  // server render.
  const { staleAfterMs } = readLiveRuntimeConfig();
  // Safe because this is a Server Component: it runs once per request, not
  // concurrently re-invoked like a Client Component render.
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();

  return (
    <main className="flex min-h-0 flex-1 flex-col bg-slate-950 text-slate-100">
      <header className="flex shrink-0 items-center gap-2.5 border-b border-slate-800 px-4 py-2.5">
        <span
          aria-hidden
          className="size-1.5 animate-pulse rounded-full bg-teal-400"
        />
        <h1 className="font-mono text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-300">
          Monitoreo en vivo
        </h1>
      </header>

      <LiveScreen
        liveState={liveState}
        tabs={tabs}
        nowMs={nowMs}
        staleAfterMs={staleAfterMs}
      />
    </main>
  );
}
