import {
  buildLiveMapClusteringHarnessPoints,
  LIVE_MAP_HARNESS_POINT_COUNT,
} from "./live-map-clustering-harness-data";

describe("buildLiveMapClusteringHarnessPoints", () => {
  it("builds the required deterministic 621-point workload", () => {
    const first = buildLiveMapClusteringHarnessPoints();
    const second = buildLiveMapClusteringHarnessPoints();

    expect(first).toHaveLength(LIVE_MAP_HARNESS_POINT_COUNT);
    expect(LIVE_MAP_HARNESS_POINT_COUNT).toBe(621);
    expect(second).toEqual(first);
    expect(new Set(first.map(({ vehicleId }) => vehicleId)).size).toBe(621);
  });

  it("includes exact overlaps and nearby points that can split by zoom", () => {
    const points = buildLiveMapClusteringHarnessPoints();
    const exactOverlapCount = points.filter(
      ({ latitude, longitude }) =>
        latitude === -24.7821 && longitude === -65.4232,
    ).length;
    const nearbyCoordinates = new Set(
      points
        .filter(({ vehicleId }) => vehicleId.startsWith("near-"))
        .map(({ latitude, longitude }) => `${latitude}:${longitude}`),
    );

    expect(exactOverlapCount).toBe(9);
    expect(nearbyCoordinates.size).toBeGreaterThan(1);
  });
});
