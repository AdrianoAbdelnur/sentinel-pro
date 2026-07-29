"use client";

import dynamic from "next/dynamic";

import type { LiveMapViewModel } from "@/application/live";

import { MAP_EMPTY_STATE_COPY } from "./live-copy";

// Leaflet touches the DOM at module scope, so it must never be evaluated during
// SSR. Next.js rejects `ssr: false` in a Server Component, which is why this
// file carries "use client".
const LiveMap = dynamic(
  () => import("./live-map").then((module) => module.LiveMap),
  {
    ssr: false,
    loading: () => (
      <p className="p-4 font-mono text-[11px] uppercase tracking-wide text-slate-600">
        Cargando mapa…
      </p>
    ),
  },
);

type LiveMapPanelProps = {
  map: LiveMapViewModel;
};

export function LiveMapPanel({ map }: LiveMapPanelProps) {
  return (
    <section aria-label="Mapa en vivo" className="relative h-full">
      <LiveMap markers={map.markers} />

      {/* Leaflet's panes stack outside the map container: z-400 ties with the
          overlay pane and wins on DOM order, but stays under markers (600) and
          controls (800+). See docs/architecture/06-live-delivery-layer.md. */}
      {map.emptyState && (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-400 flex justify-center px-4">
          <p className="pointer-events-auto max-w-sm rounded-full border border-slate-700/80 bg-slate-950/90 px-4 py-1.5 text-center text-[12px] leading-relaxed text-slate-300 shadow-lg backdrop-blur-sm">
            {MAP_EMPTY_STATE_COPY[map.emptyState.code]}
          </p>
        </div>
      )}
    </section>
  );
}
