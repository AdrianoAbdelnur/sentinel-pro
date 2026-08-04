import type { LiveMapClusterPoint } from "./live-map-clustering";

export const LIVE_MAP_HARNESS_POINT_COUNT = 621;

export function buildLiveMapClusteringHarnessPoints(): LiveMapClusterPoint[] {
  const distributedPoints = Array.from({ length: 600 }, (_, index) => {
    const row = Math.floor(index / 30);
    const column = index % 30;

    return {
      vehicleId: `distributed-${String(index + 1).padStart(3, "0")}`,
      latitude: -54 + row * 1.45 + ((column * 7) % 5) * 0.012,
      longitude: -73 + column * 0.75 + ((row * 11) % 7) * 0.015,
    };
  });
  const nearbyPoints = Array.from({ length: 12 }, (_, index) => ({
    vehicleId: `near-${String(index + 1).padStart(2, "0")}`,
    latitude: -34.6037 + (index % 4) * 0.0012,
    longitude: -58.3816 + Math.floor(index / 4) * 0.0015,
  }));
  const overlapPoints = Array.from({ length: 9 }, (_, index) => ({
    vehicleId: `overlap-${String(index + 1).padStart(2, "0")}`,
    latitude: -24.7821,
    longitude: -65.4232,
  }));

  return [...distributedPoints, ...nearbyPoints, ...overlapPoints];
}
