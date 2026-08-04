"use client";

import "leaflet/dist/leaflet.css";

import { useEffect } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";

import type { LiveMapMarker } from "@/application/live";

import { LiveMapMarkerLayer } from "./live-map-marker-layer";

const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const FALLBACK_CENTER: [number, number] = [-34.6037, -58.3816];
const FALLBACK_ZOOM = 11;

type LiveMapProps = {
  markers: LiveMapMarker[];
};

export function LiveMap({ markers }: LiveMapProps) {
  return (
    <MapContainer
      center={toPosition(markers[0]) ?? FALLBACK_CENTER}
      zoom={FALLBACK_ZOOM}
      scrollWheelZoom
      className="h-full w-full"
    >
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />

      <LiveMapMarkerLayer markers={markers} />

      <FitBounds markers={markers} />
      <InvalidateOnResize />
    </MapContainer>
  );
}

function InvalidateOnResize() {
  const map = useMap();

  useEffect(() => {
    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const container = map.getContainer();
    const observer = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
    });

    observer.observe(container);

    return () => observer.disconnect();
  }, [map]);

  return null;
}

function FitBounds({ markers }: LiveMapProps) {
  const map = useMap();
  const bounds = markers.map(toPosition).filter(isPosition);
  const boundsKey = JSON.stringify(bounds);

  useEffect(() => {
    const positions: [number, number][] = JSON.parse(boundsKey);

    if (positions.length === 0) {
      return;
    }

    map.fitBounds(positions, { padding: [40, 40], maxZoom: 15 });
  }, [map, boundsKey]);

  return null;
}

function toPosition(marker?: LiveMapMarker): [number, number] | undefined {
  return marker ? [marker.latitude, marker.longitude] : undefined;
}

function isPosition(
  position?: [number, number],
): position is [number, number] {
  return position !== undefined;
}
