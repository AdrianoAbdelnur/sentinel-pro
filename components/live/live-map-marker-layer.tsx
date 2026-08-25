"use client";

import { Marker, Polyline, Tooltip } from "react-leaflet";

import type { LiveMapMarker } from "@/application/live";

import {
  createLiveMapClusterIcon,
  createLiveMapVehicleIcon,
} from "./live-map-icons";
import { useLiveMapClusters } from "./use-live-map-clusters";

type LiveMapMarkerLayerProps = {
  markers: LiveMapMarker[];
};

export function LiveMapMarkerLayer({
  markers,
}: LiveMapMarkerLayerProps) {
  const {
    entries,
    fanClusterId,
    fanMembers,
    activateCluster,
    collapseFan,
  } = useLiveMapClusters(markers);
  const markerById = new Map(
    markers.map((marker) => [marker.vehicleId, marker]),
  );

  return (
    <>
      {entries.map((entry) => {
        if (entry.kind === "cluster") {
          if (entry.clusterId === fanClusterId) {
            return null;
          }

          const title = `Grupo de ${entry.count} vehículos`;

          return (
            <Marker
              key={`cluster-${entry.clusterId}`}
              position={[entry.latitude, entry.longitude]}
              title={title}
              icon={createLiveMapClusterIcon(entry.count)}
              eventHandlers={{
                click: () => activateCluster(entry.clusterId),
              }}
            />
          );
        }

        const marker = markerById.get(entry.vehicleId);

        if (!marker) {
          return null;
        }

          return (
            <Marker
              key={marker.vehicleId}
              position={[entry.latitude, entry.longitude]}
              title={marker.label}
              icon={createLiveMapVehicleIcon(marker)}
            >
              <VehicleTooltip marker={marker} />
            </Marker>
          );
      })}

      {fanMembers.map(({ marker, sourcePosition, displayPosition }) => (
        <FanMember
          key={`fan-${marker.vehicleId}`}
          marker={marker}
          sourcePosition={sourcePosition}
          displayPosition={displayPosition}
          onCollapse={collapseFan}
        />
      ))}
    </>
  );
}

function VehicleTooltip({ marker }: { marker: LiveMapMarker }) {
  return (
    <Tooltip
      permanent
      direction="right"
      offset={[16, -14]}
      opacity={0.96}
      className="!border-0 !bg-transparent !p-0 !shadow-none"
    >
      <span className="block min-w-28 rounded border border-slate-300 bg-white px-2 py-1 text-left font-sans text-[11px] leading-tight text-slate-700 shadow-md">
        <span className="block max-w-48 truncate">{marker.label}</span>
        {marker.status === "offline" ? (
          <span className="mt-0.5 block font-semibold text-rose-600">Offline</span>
        ) : typeof marker.speedKmH === "number" && Number.isFinite(marker.speedKmH) ? (
          <span className="mt-0.5 block font-semibold text-emerald-600">
            {Math.round(marker.speedKmH)} km/h
          </span>
        ) : null}
      </span>
    </Tooltip>
  );
}

type FanMemberProps = {
  marker: LiveMapMarker;
  sourcePosition: [number, number];
  displayPosition: [number, number];
  onCollapse: () => void;
};

function FanMember({
  marker,
  sourcePosition,
  displayPosition,
  onCollapse,
}: FanMemberProps) {
  return (
    <>
      <Polyline
        positions={[sourcePosition, displayPosition]}
        pathOptions={{ color: "#003b73", opacity: 0.55, weight: 1 }}
      />
      <Marker
        position={displayPosition}
        title={marker.label}
        icon={createLiveMapVehicleIcon(marker)}
        eventHandlers={{ click: onCollapse }}
      >
        <VehicleTooltip marker={marker} />
      </Marker>
    </>
  );
}
