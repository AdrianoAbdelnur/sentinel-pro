import type { Metadata } from "next";

import { LiveScreen } from "@/components/live/live-screen";
import { inMemoryLiveDataSource } from "@/integrations/live/in-memory/in-memory-live-data-source";

export const metadata: Metadata = {
  title: "Live · Sentinel Pro",
  description: "Operational live monitoring for fleets and vehicles.",
};

export default function LivePage() {
  const liveState = inMemoryLiveDataSource.readLiveState();
  const tabs = inMemoryLiveDataSource.readBottomPanelTabs();

  return (
    <main className="flex min-h-0 flex-1 flex-col bg-zinc-950 text-zinc-50">
      <header className="shrink-0 border-b border-zinc-800 px-4 py-3">
        <h1 className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-400">
          Live
        </h1>
      </header>

      <LiveScreen liveState={liveState} tabs={tabs} />
    </main>
  );
}
