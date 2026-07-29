import type { VehicleStatus } from "@/application/live";

// Every value below must stay a complete, literal class string. Tailwind v4
// extracts classes by scanning source text, so `bg-${hue}-500/15` emits no CSS.
export type VehicleStatusTone = {
  rail: string;
  dot: string;
  badge: string;
  chipActive: string;
  count: string;
  speed: string;
};

export const VEHICLE_STATUS_TONE: Record<VehicleStatus, VehicleStatusTone> = {
  "en-route": {
    rail: "bg-teal-400",
    dot: "bg-teal-300",
    badge: "bg-teal-400/10 text-teal-300 ring-1 ring-inset ring-teal-400/25",
    chipActive: "bg-teal-400/15 text-teal-200 ring-teal-400/40",
    count: "text-teal-300",
    speed: "text-teal-300",
  },
  stopped: {
    rail: "bg-amber-400",
    dot: "bg-amber-300",
    badge: "bg-amber-400/10 text-amber-300 ring-1 ring-inset ring-amber-400/25",
    chipActive: "bg-amber-400/15 text-amber-200 ring-amber-400/40",
    count: "text-amber-300",
    speed: "text-amber-300/80",
  },
  offline: {
    rail: "bg-rose-500",
    dot: "bg-rose-400",
    badge: "bg-rose-500/10 text-rose-300 ring-1 ring-inset ring-rose-500/30",
    chipActive: "bg-rose-500/15 text-rose-200 ring-rose-500/40",
    count: "text-rose-300",
    speed: "text-slate-600",
  },
};
