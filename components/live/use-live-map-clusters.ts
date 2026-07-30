"use client";

import type { Map as LeafletMap } from "leaflet";
import { useCallback, useMemo, useState } from "react";
import { useMap, useMapEvents } from "react-leaflet";

import type { LiveMapMarker } from "@/application/live";

import {
  buildLiveMapClusterIndex,
  buildLiveMapCoordinateSignature,
  getLiveMapClusterExpansionZoom,
  getLiveMapClusterLeaves,
  queryLiveMapClusters,
  type LiveMapClusterEntry,
  type LiveMapClusterIndex,
  type LiveMapBounds,
} from "./live-map-clustering";
import { buildDeterministicOverlapLayout } from "./live-map-overlap-layout";

const MAX_CLUSTER_ZOOM = 18;

type Position = [number, number];

export type LiveMapFanMember = {
  readonly marker: LiveMapMarker;
  readonly sourcePosition: Position;
  readonly displayPosition: Position;
};

export type UseLiveMapClustersResult = {
  readonly entries: LiveMapClusterEntry[];
  readonly fanClusterId?: number;
  readonly fanMembers: LiveMapFanMember[];
  readonly activateCluster: (clusterId: number) => void;
  readonly collapseFan: () => void;
};

export function useLiveMapClusters(
  markers: readonly LiveMapMarker[],
): UseLiveMapClustersResult {
  const index = useCoordinateIndex(markers);
  const map = useMap();
  const [viewport, setViewport] = useState(() => readViewport(map));
  const [fanClusterId, setFanClusterId] = useState<number>();
  const [fanMembers, setFanMembers] = useState<LiveMapFanMember[]>([]);

  const collapseFan = useCallback(() => {
    setFanClusterId(undefined);
    setFanMembers([]);
  }, []);

  const settleViewport = useCallback(
    () => {
      setViewport(readViewport(map));
      collapseFan();
    },
    [collapseFan, map],
  );

  useMapEvents({
    moveend: settleViewport,
    zoomend: settleViewport,
  });

  const entries = useMemo(
    () => queryLiveMapClusters(index, viewport.bounds, viewport.zoom),
    [index, viewport],
  );

  const activateCluster = useCallback(
    (clusterId: number) => {
      const leaves = getLiveMapClusterLeaves(index, clusterId);

      if (map.getZoom() < MAX_CLUSTER_ZOOM) {
        map.fitBounds(
          leaves.map(
            ({ latitude, longitude }): Position => [latitude, longitude],
          ),
          {
            animate: true,
            padding: [40, 40],
            maxZoom: Math.min(
              getLiveMapClusterExpansionZoom(index, clusterId),
              MAX_CLUSTER_ZOOM,
            ),
          },
        );
        collapseFan();
        return;
      }

      const markerById = new Map(
        markers.map((marker) => [marker.vehicleId, marker]),
      );
      const leafById = new Map(
        leaves.map((leaf) => [leaf.vehicleId, leaf]),
      );
      const layout = buildDeterministicOverlapLayout(
        leaves.map(({ vehicleId }) => vehicleId),
      );

      setFanClusterId(clusterId);
      setFanMembers(
        layout.flatMap(({ vehicleId, offsetX, offsetY }) => {
          const marker = markerById.get(vehicleId);
          const leaf = leafById.get(vehicleId);

          if (!marker || !leaf) {
            return [];
          }

          const sourcePosition: Position = [leaf.latitude, leaf.longitude];
          const sourcePoint = map.latLngToContainerPoint(sourcePosition);
          const displayLatLng = map.containerPointToLatLng(
            sourcePoint.add([offsetX, offsetY]),
          );

          return [
            {
              marker,
              sourcePosition,
              displayPosition: [displayLatLng.lat, displayLatLng.lng],
            },
          ];
        }),
      );
    },
    [collapseFan, index, map, markers],
  );

  return {
    entries,
    fanClusterId,
    fanMembers,
    activateCluster,
    collapseFan,
  };
}

function resolveQueryBounds(
  west: number,
  south: number,
  east: number,
  north: number,
): LiveMapBounds {
  if (west === east || south === north) {
    return [-180, -90, 180, 90];
  }

  return [west, south, east, north];
}

function readViewport(map: LeafletMap): {
  bounds: LiveMapBounds;
  zoom: number;
} {
  const bounds = map.getBounds();

  return {
    bounds: resolveQueryBounds(
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth(),
    ),
    zoom: map.getZoom(),
  };
}

function useCoordinateIndex(
  markers: readonly LiveMapMarker[],
): LiveMapClusterIndex {
  const signature = buildLiveMapCoordinateSignature(markers);

  return useMemo(
    () => buildLiveMapClusterIndex(markers),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signature],
  );
}
