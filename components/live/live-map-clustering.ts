import Supercluster from "supercluster";

export type LiveMapClusterPoint = {
  readonly vehicleId: string;
  readonly latitude: number;
  readonly longitude: number;
};

export type LiveMapClusterEntry =
  | {
      readonly kind: "cluster";
      readonly clusterId: number;
      readonly count: number;
      readonly latitude: number;
      readonly longitude: number;
    }
  | {
      readonly kind: "point";
      readonly vehicleId: string;
      readonly latitude: number;
      readonly longitude: number;
    };

type PointProperties = {
  vehicleId: string;
};

type ClusterProperties = Record<string, never>;

export type LiveMapClusterIndex = Supercluster<
  PointProperties,
  ClusterProperties
>;

export type LiveMapBounds = readonly [
  west: number,
  south: number,
  east: number,
  north: number,
];

export function buildLiveMapCoordinateSignature(
  points: readonly LiveMapClusterPoint[],
): string {
  return [...points]
    .sort(compareByVehicleId)
    .map(
      ({ vehicleId, latitude, longitude }) =>
        `${vehicleId}:${latitude}:${longitude}`,
    )
    .join("|");
}

export function buildLiveMapClusterIndex(
  points: readonly LiveMapClusterPoint[],
): LiveMapClusterIndex {
  const features: Array<Supercluster.PointFeature<PointProperties>> =
    points.map(({ vehicleId, latitude, longitude }) => ({
      type: "Feature",
      properties: { vehicleId },
      geometry: {
        type: "Point",
        coordinates: [longitude, latitude],
      },
    }));

  return new Supercluster<PointProperties, ClusterProperties>({
    radius: 60,
    maxZoom: 18,
  }).load(features);
}

export function queryLiveMapClusters(
  index: LiveMapClusterIndex,
  bounds: LiveMapBounds,
  zoom: number,
): LiveMapClusterEntry[] {
  return index
    .getClusters([...bounds], Math.floor(zoom))
    .map((feature): LiveMapClusterEntry => {
      const [longitude, latitude] = feature.geometry.coordinates;

      if ("cluster" in feature.properties) {
        return {
          kind: "cluster",
          clusterId: feature.properties.cluster_id,
          count: feature.properties.point_count,
          latitude,
          longitude,
        };
      }

      return {
        kind: "point",
        vehicleId: feature.properties.vehicleId,
        latitude,
        longitude,
      };
    });
}

export function getLiveMapClusterLeaves(
  index: LiveMapClusterIndex,
  clusterId: number,
): LiveMapClusterPoint[] {
  return index
    .getLeaves(clusterId, Infinity)
    .map(({ properties, geometry }) => ({
      vehicleId: properties.vehicleId,
      latitude: geometry.coordinates[1],
      longitude: geometry.coordinates[0],
    }))
    .sort(compareByVehicleId);
}

export function getLiveMapClusterExpansionZoom(
  index: LiveMapClusterIndex,
  clusterId: number,
): number {
  return index.getClusterExpansionZoom(clusterId);
}

function compareByVehicleId(
  left: LiveMapClusterPoint,
  right: LiveMapClusterPoint,
): number {
  if (left.vehicleId === right.vehicleId) {
    return 0;
  }

  return left.vehicleId < right.vehicleId ? -1 : 1;
}
