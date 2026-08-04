import { act, renderHook, waitFor } from "@testing-library/react";
import type { LatLngBounds } from "leaflet";
import { vi } from "vitest";

import type { LiveMapMarker } from "@/application/live";

const mapHarness = vi.hoisted(() => {
  const eventHandlers: Record<string, () => void> = {};
  const map = {
    fitBounds: vi.fn(),
    getBounds: vi.fn(),
    getZoom: vi.fn(),
    latLngToContainerPoint: vi.fn(),
    containerPointToLatLng: vi.fn(),
  };

  return { eventHandlers, map };
});

vi.mock("react-leaflet", () => ({
  useMap: () => mapHarness.map,
  useMapEvents: (handlers: Record<string, () => void>) => {
    Object.assign(mapHarness.eventHandlers, handlers);
    return mapHarness.map;
  },
}));

const { useLiveMapClusters } = await import("./use-live-map-clusters");

const markers: LiveMapMarker[] = [
  {
    vehicleId: "vehicle-b",
    label: "Unit B",
    latitude: -34.6037,
    longitude: -58.3816,
  },
  {
    vehicleId: "vehicle-a",
    label: "Unit A",
    latitude: -34.6037,
    longitude: -58.3816,
  },
];

function bounds(
  west: number,
  south: number,
  east: number,
  north: number,
): LatLngBounds {
  return {
    getWest: () => west,
    getSouth: () => south,
    getEast: () => east,
    getNorth: () => north,
  } as LatLngBounds;
}

describe("useLiveMapClusters", () => {
  beforeEach(() => {
    mapHarness.map.fitBounds.mockReset();
    mapHarness.map.getBounds.mockReturnValue(bounds(-59, -35, -58, -34));
    mapHarness.map.getZoom.mockReturnValue(8);
    mapHarness.map.latLngToContainerPoint.mockImplementation(
      ([latitude, longitude]: [number, number]) => ({
        x: longitude * 100,
        y: latitude * 100,
        add([offsetX, offsetY]: [number, number]) {
          return { x: this.x + offsetX, y: this.y + offsetY };
        },
      }),
    );
    mapHarness.map.containerPointToLatLng.mockImplementation(
      ({ x, y }: { x: number; y: number }) => ({
        lat: y / 100,
        lng: x / 100,
      }),
    );
    Object.keys(mapHarness.eventHandlers).forEach(
      (eventName) => delete mapHarness.eventHandlers[eventName],
    );
  });

  it("queries only after initial render and settled map events", async () => {
    const { result } = renderHook(() => useLiveMapClusters(markers));

    await waitFor(() => {
      expect(result.current.entries).toEqual([
        expect.objectContaining({ kind: "cluster", count: 2 }),
      ]);
    });

    mapHarness.map.getBounds.mockReturnValue(bounds(-57, -35, -56, -34));
    act(() => mapHarness.eventHandlers.moveend());

    expect(result.current.entries).toEqual([]);

    mapHarness.map.getBounds.mockReturnValue(bounds(-59, -35, -58, -34));
    mapHarness.map.getZoom.mockReturnValue(18);
    act(() => mapHarness.eventHandlers.zoomend());

    expect(result.current.entries).toEqual([
      expect.objectContaining({ kind: "cluster", count: 2 }),
    ]);
  });

  it("keeps logical markers available while the map container has zero size", async () => {
    mapHarness.map.getBounds.mockReturnValue(bounds(0, 0, 0, 0));

    const { result } = renderHook(() => useLiveMapClusters(markers));

    await waitFor(() => {
      expect(result.current.entries).toEqual([
        expect.objectContaining({ kind: "cluster", count: 2 }),
      ]);
    });
  });

  it("expands a cluster to source-coordinate bounds without selecting", async () => {
    const { result } = renderHook(() => useLiveMapClusters(markers));

    await waitFor(() => expect(result.current.entries).toHaveLength(1));
    const [entry] = result.current.entries;
    if (entry.kind !== "cluster") {
      throw new Error("Expected a cluster");
    }

    act(() => result.current.activateCluster(entry.clusterId));

    expect(mapHarness.map.fitBounds).toHaveBeenCalledWith(
      [
        [-34.6037, -58.3816],
        [-34.6037, -58.3816],
      ],
      expect.objectContaining({ animate: true }),
    );
    expect(result.current.fanMembers).toEqual([]);
  });

  it("fans exact overlaps deterministically at maximum zoom and collapses them", async () => {
    mapHarness.map.getZoom.mockReturnValue(18);
    const { result } = renderHook(() => useLiveMapClusters(markers));

    await waitFor(() => expect(result.current.entries).toHaveLength(1));
    const [entry] = result.current.entries;
    if (entry.kind !== "cluster") {
      throw new Error("Expected a cluster");
    }

    act(() => result.current.activateCluster(entry.clusterId));

    expect(result.current.fanMembers.map(({ marker }) => marker.vehicleId)).toEqual([
      "vehicle-a",
      "vehicle-b",
    ]);
    expect(
      result.current.fanMembers.every(
        ({ sourcePosition, displayPosition }) =>
          sourcePosition[0] === -34.6037 &&
          sourcePosition[1] === -58.3816 &&
          displayPosition.join(",") !== sourcePosition.join(","),
      ),
    ).toBe(true);

    act(() => result.current.collapseFan());

    expect(result.current.fanMembers).toEqual([]);
  });

  it("clears an open fan after either settled movement event", async () => {
    mapHarness.map.getZoom.mockReturnValue(18);
    const { result } = renderHook(() => useLiveMapClusters(markers));

    await waitFor(() => expect(result.current.entries).toHaveLength(1));
    const [entry] = result.current.entries;
    if (entry.kind !== "cluster") {
      throw new Error("Expected a cluster");
    }

    act(() => result.current.activateCluster(entry.clusterId));
    expect(result.current.fanMembers).toHaveLength(2);

    act(() => mapHarness.eventHandlers.moveend());
    expect(result.current.fanMembers).toEqual([]);

    act(() => result.current.activateCluster(entry.clusterId));
    act(() => mapHarness.eventHandlers.zoomend());
    expect(result.current.fanMembers).toEqual([]);
  });
});
