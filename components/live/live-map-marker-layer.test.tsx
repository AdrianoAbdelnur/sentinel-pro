import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

import type { LiveMapMarker } from "@/application/live";

const clusterHook = vi.hoisted(() => ({
  activateCluster: vi.fn(),
  collapseFan: vi.fn(),
  entries: [] as Array<Record<string, unknown>>,
  fanMembers: [] as Array<Record<string, unknown>>,
}));

vi.mock("react-leaflet", () => ({
  Marker: ({
    position,
    title,
    icon,
    eventHandlers,
  }: {
    position: [number, number];
    title?: string;
    icon: { options: { html: string } };
    eventHandlers?: { click?: () => void };
  }) => (
    <button
      type="button"
      data-testid="declarative-marker"
      data-position={position.join(",")}
      data-icon={icon.options.html}
      title={title}
      onClick={eventHandlers?.click}
    />
  ),
  Polyline: ({
    positions,
    pathOptions,
  }: {
    positions: [[number, number], [number, number]];
    pathOptions: { color: string };
  }) => (
    <span
      data-testid="fan-leg"
      data-positions={JSON.stringify(positions)}
      data-color={pathOptions.color}
    />
  ),
}));

vi.mock("./use-live-map-clusters", () => ({
  useLiveMapClusters: () => clusterHook,
}));

const { LiveMapMarkerLayer } = await import("./live-map-marker-layer");

const markers: LiveMapMarker[] = [
  {
    vehicleId: "vehicle-101",
    label: "Unit 101",
    latitude: -34.6037,
    longitude: -58.3816,
    headingDeg: 90,
  },
  {
    vehicleId: "vehicle-201",
    label: "Unit 201",
    latitude: -34.60371,
    longitude: -58.38161,
  },
];

describe("LiveMapMarkerLayer", () => {
  beforeEach(() => {
    clusterHook.activateCluster.mockReset();
    clusterHook.collapseFan.mockReset();
    clusterHook.entries = [];
    clusterHook.fanMembers = [];
  });

  it("renders ordinary React Leaflet markers with titles and headings", () => {
    clusterHook.entries = [
      {
        kind: "point",
        vehicleId: "vehicle-101",
        latitude: -34.6037,
        longitude: -58.3816,
      },
      {
        kind: "point",
        vehicleId: "vehicle-201",
        latitude: -34.60371,
        longitude: -58.38161,
      },
    ];

    render(<LiveMapMarkerLayer markers={markers} />);

    expect(screen.getAllByTestId("declarative-marker")).toHaveLength(2);
    expect(screen.getByTitle("Unit 101").dataset.icon).toContain(
      "--marker-rotation:90deg",
    );
    expect(screen.getByTitle("Unit 201").dataset.icon).not.toContain(
      "--marker-rotation:",
    );
  });

  it("shows an accessible count and activates only the cluster", () => {
    clusterHook.entries = [
      {
        kind: "cluster",
        clusterId: 42,
        count: 2,
        latitude: -34.6037,
        longitude: -58.3816,
      },
    ];

    render(<LiveMapMarkerLayer markers={markers} />);
    fireEvent.click(screen.getByTitle("Grupo de 2 vehículos"));

    expect(clusterHook.activateCluster).toHaveBeenCalledWith(42);
    expect(screen.getAllByTestId("declarative-marker")).toHaveLength(1);
  });

  it("renders every fanned logical marker and its source leg", () => {
    clusterHook.fanMembers = markers.map((marker, index) => ({
      marker,
      sourcePosition: [marker.latitude, marker.longitude],
      displayPosition: [
        marker.latitude + (index + 1) * 0.001,
        marker.longitude + (index + 1) * 0.001,
      ],
    }));

    render(<LiveMapMarkerLayer markers={markers} />);

    expect(screen.getAllByTestId("declarative-marker")).toHaveLength(2);
    expect(screen.getAllByTestId("fan-leg")).toHaveLength(2);
    expect(screen.getAllByTestId("fan-leg")[0]).toHaveAttribute(
      "data-color",
      "#0e639c",
    );
    expect(screen.getByTitle("Unit 101")).toBeInTheDocument();
    expect(screen.getByTitle("Unit 201")).toBeInTheDocument();
  });
});
