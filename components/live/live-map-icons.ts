import { divIcon, type DivIcon } from "leaflet";

import type { LiveMapMarker } from "@/application/live";

const VEHICLE_ICON_SIZE = 28;
const CLUSTER_ICON_SIZE = 42;

export function createLiveMapVehicleIcon(
  marker: LiveMapMarker,
): DivIcon {
  const rotation =
    typeof marker.headingDeg === "number"
      ? ` style="--marker-rotation:${marker.headingDeg}deg"`
      : "";
  const label = escapeHtml(marker.label);

  return divIcon({
    html: `<span role="img" aria-label="${label}" class="flex size-7 items-center justify-center rounded-full border-2 border-[#0e639c] bg-blue-950 shadow-[0_0_12px_rgba(0,120,212,0.55)]"><span aria-hidden="true" class="rotate-[var(--marker-rotation,0deg)] text-base leading-none text-[#0078d4]"${rotation}>&#9650;</span></span>`,
    className: "",
    iconSize: [VEHICLE_ICON_SIZE, VEHICLE_ICON_SIZE],
    iconAnchor: [VEHICLE_ICON_SIZE / 2, VEHICLE_ICON_SIZE / 2],
  });
}

export function createLiveMapClusterIcon(count: number): DivIcon {
  const label = `Grupo de ${count} vehículos`;

  return divIcon({
    html: `<span role="img" aria-label="${label}" class="flex size-[42px] items-center justify-center rounded-full border-2 border-[#0e639c] bg-blue-950 font-mono text-sm font-bold text-[#0078d4] shadow-[0_0_18px_rgba(0,120,212,0.6)]">${count}</span>`,
    className: "",
    iconSize: [CLUSTER_ICON_SIZE, CLUSTER_ICON_SIZE],
    iconAnchor: [CLUSTER_ICON_SIZE / 2, CLUSTER_ICON_SIZE / 2],
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
