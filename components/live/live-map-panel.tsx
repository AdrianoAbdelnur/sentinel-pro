"use client";

import dynamic from "next/dynamic";

import type { LiveMapViewModel } from "@/application/live";

// Leaflet reads `window` at module scope, so the map must never be evaluated
// during SSR. `ssr: false` is only valid inside a Client Component.
const LiveMap = dynamic(
  () => import("./live-map").then((module) => module.LiveMap),
  {
    ssr: false,
    loading: () => (
      <p className="p-4 text-sm text-zinc-500">Loading map…</p>
    ),
  },
);

type LiveMapPanelProps = {
  map: LiveMapViewModel;
};

export function LiveMapPanel({ map }: LiveMapPanelProps) {
  if (map.emptyState) {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-900/40 px-6 text-center">
        <p className="text-sm text-zinc-500">{map.emptyState.message}</p>
      </div>
    );
  }

  return (
    <section aria-label="Live map" className="h-full">
      <LiveMap markers={map.markers} />
    </section>
  );
}
