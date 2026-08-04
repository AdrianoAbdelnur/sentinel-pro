import { describe, expect, it } from "vitest";

import {
  buildLiveMapCoordinateSignature,
  buildLiveMapClusterIndex,
  getLiveMapClusterExpansionZoom,
  getLiveMapClusterLeaves,
  queryLiveMapClusters,
} from "./live-map-clustering";

const nearbyMarkers = [
  {
    vehicleId: "vehicle-101",
    latitude: -34.6037,
    longitude: -58.3816,
  },
  {
    vehicleId: "vehicle-201",
    latitude: -34.60371,
    longitude: -58.38161,
  },
] as const;

describe("buildLiveMapCoordinateSignature", () => {
  it("is stable across input order and changes with a coordinate", () => {
    const signature = buildLiveMapCoordinateSignature(nearbyMarkers);
    const reordered = buildLiveMapCoordinateSignature([
      nearbyMarkers[1],
      nearbyMarkers[0],
    ]);
    const moved = buildLiveMapCoordinateSignature([
      nearbyMarkers[0],
      { ...nearbyMarkers[1], longitude: -58.4 },
    ]);

    expect(reordered).toBe(signature);
    expect(moved).not.toBe(signature);
  });
});

describe("live map cluster index", () => {
  it("clusters nearby points and separates distant points", () => {
    const index = buildLiveMapClusterIndex([
      ...nearbyMarkers,
      {
        vehicleId: "vehicle-301",
        latitude: -31.4201,
        longitude: -64.1888,
      },
    ]);

    const entries = queryLiveMapClusters(
      index,
      [-70, -40, -50, -20],
      8,
    );

    expect(entries).toHaveLength(2);
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "cluster", count: 2 }),
        expect.objectContaining({
          kind: "point",
          vehicleId: "vehicle-301",
          latitude: -31.4201,
          longitude: -64.1888,
        }),
      ]),
    );
  });

  it("returns only points inside the requested bounds", () => {
    const index = buildLiveMapClusterIndex([
      nearbyMarkers[0],
      {
        vehicleId: "vehicle-301",
        latitude: -31.4201,
        longitude: -64.1888,
      },
    ]);

    const entries = queryLiveMapClusters(
      index,
      [-59, -35, -58, -34],
      18,
    );

    expect(entries).toEqual([
      {
        kind: "point",
        vehicleId: "vehicle-101",
        latitude: -34.6037,
        longitude: -58.3816,
      },
    ]);
  });

  it("copies source coordinates and keeps GeoJSON properties minimal", () => {
    const mutableMarkers: Array<{
      vehicleId: string;
      latitude: number;
      longitude: number;
    }> = [{ ...nearbyMarkers[0] }];
    const index = buildLiveMapClusterIndex(mutableMarkers);
    mutableMarkers[0].latitude = 0;

    const entries = queryLiveMapClusters(
      index,
      [-59, -35, -58, -34],
      18,
    );
    const point = entries.find(
      (entry) => entry.kind === "point" && entry.vehicleId === "vehicle-101",
    );
    const [feature] = index.getClusters([-59, -35, -58, -34], 18);

    expect(point).toEqual({
      kind: "point",
      vehicleId: "vehicle-101",
      latitude: -34.6037,
      longitude: -58.3816,
    });
    expect(feature.properties).toEqual({ vehicleId: "vehicle-101" });
  });

  it("returns every leaf and the expansion zoom for a cluster", () => {
    const index = buildLiveMapClusterIndex(nearbyMarkers);
    const [cluster] = queryLiveMapClusters(
      index,
      [-59, -35, -58, -34],
      8,
    );

    expect(cluster.kind).toBe("cluster");
    if (cluster.kind !== "cluster") {
      throw new Error("Expected a cluster");
    }

    expect(getLiveMapClusterLeaves(index, cluster.clusterId)).toEqual(
      expect.arrayContaining([
        {
          vehicleId: "vehicle-101",
          latitude: -34.6037,
          longitude: -58.3816,
        },
        {
          vehicleId: "vehicle-201",
          latitude: -34.60371,
          longitude: -58.38161,
        },
      ]),
    );
    expect(
      getLiveMapClusterExpansionZoom(index, cluster.clusterId),
    ).toBeGreaterThan(8);
  });
});
