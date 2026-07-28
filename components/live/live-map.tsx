"use client";

import "leaflet/dist/leaflet.css";

import { divIcon } from "leaflet";
import { useEffect } from "react";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";

import type { LiveMapMarker } from "@/application/live";

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

      {markers.map((marker) => (
        <Marker
          key={marker.vehicleId}
          position={[marker.latitude, marker.longitude]}
          title={marker.label}
          icon={divIcon({
            html: buildMarkerHtml(marker),
            className: "",
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          })}
        />
      ))}

      <FitBounds markers={markers} />
    </MapContainer>
  );
}

export function buildMarkerHtml(marker: LiveMapMarker): string {
  const rotation =
    typeof marker.headingDeg === "number"
      ? `transform:rotate(${marker.headingDeg}deg);`
      : "";

  return `<span style="display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:9999px;background:rgba(16,185,129,0.25);"><span style="${rotation}color:#10b981;font-size:14px;line-height:1;">&#9650;</span></span>`;
}

function FitBounds({ markers }: LiveMapProps) {
  const map = useMap();
  // Serialised so the effect reacts to coordinate changes, not array identity.
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
