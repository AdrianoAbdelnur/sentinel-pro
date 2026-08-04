"use client";

import dynamic from "next/dynamic";

import type { LiveMapViewModel } from "@/application/live";

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
    </section>
  );
}
