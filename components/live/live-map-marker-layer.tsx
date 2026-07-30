"use client";

import { Marker, Polyline } from "react-leaflet";

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
          />
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
        pathOptions={{ color: "#2563eb", opacity: 0.55, weight: 1 }}
      />
      <Marker
        position={displayPosition}
        title={marker.label}
        icon={createLiveMapVehicleIcon(marker)}
        eventHandlers={{ click: onCollapse }}
      />
    </>
  );
}
