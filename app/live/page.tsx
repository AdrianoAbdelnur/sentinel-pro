import type { Metadata } from "next";

import { LiveScreen } from "@/components/live/live-screen";
import { LiveLogoutButton } from "./live-logout-button";
import { aggregateOperationalSources } from "@/application/live";
import { createLiveReadSwitch, readLiveCompatibilityMode } from "@/application/live/live-compatibility-loader";
import {
  readInMemoryBottomPanelFixtures,
} from "@/integrations/live/in-memory/in-memory-live-data-source";

import { createOperationalSources } from "./create-operational-sources";
import { readLiveRuntimeConfig } from "./live-runtime-config";
import { requirePageAuthorization } from "../require-page-authorization";

export const metadata: Metadata = {
  title: "Live · Sentinel Pro",
  description: "Operational live monitoring for fleets and vehicles.",
};

export const dynamic = "force-dynamic";

export default async function LivePage() {
  await requirePageAuthorization("operator");
  const runtime = readLiveRuntimeConfig();
  const liveReadSwitch = createLiveReadSwitch(readLiveCompatibilityMode());
  const sources = createOperationalSources({ ...runtime, liveReadSwitch });
  const { state, warnings } = await aggregateOperationalSources(sources);
  const tabs = runtime.includeDevelopmentFixtures
    ? readInMemoryBottomPanelFixtures()
    : [];
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
        <LiveLogoutButton />
      </header>

      <LiveScreen
        liveState={state}
        tabs={tabs}
        nowMs={nowMs}
        staleAfterMs={runtime.staleAfterMs}
        warnings={warnings}
      />
    </main>
  );
}
