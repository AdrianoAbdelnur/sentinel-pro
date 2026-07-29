import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

import type { LiveMapMarker } from "@/application/live";

const mapSpies = vi.hoisted(() => ({
  fitBounds: vi.fn(),
  invalidateSize: vi.fn(),
  getContainer: vi.fn(() => document.createElement("div")),
}));

const resizeObserverSpies = vi.hoisted(() => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
  callbacks: [] as ResizeObserverCallback[],
}));

vi.stubGlobal(
  "ResizeObserver",
  class {
    constructor(callback: ResizeObserverCallback) {
      resizeObserverSpies.callbacks.push(callback);
    }
    observe = resizeObserverSpies.observe;
    disconnect = resizeObserverSpies.disconnect;
    unobserve = vi.fn();
  },
);

vi.mock("leaflet/dist/leaflet.css", () => ({}));

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: ({ url, attribution }: { url: string; attribution: string }) => (
    <div data-testid="tile-layer" data-url={url} data-attribution={attribution} />
  ),
  Marker: ({
    position,
    title,
    icon,
  }: {
    position: [number, number];
    title: string;
    icon: { options: { html: string } };
  }) => (
    <div
      data-testid="marker"
      title={title}
      data-position={position.join(",")}
      data-html={icon.options.html}
    />
  ),
  useMap: () => mapSpies,
}));

const { LiveMap, buildMarkerHtml } = await import("./live-map");

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
    latitude: -34.9011,
    longitude: -56.1645,
  },
];

describe("LiveMap", () => {
  beforeEach(() => {
    mapSpies.fitBounds.mockClear();
  });

  it("renders one marker per view model entry", () => {
    render(<LiveMap markers={markers} />);

    expect(screen.getAllByTestId("marker")).toHaveLength(2);
  });

  it("places each marker at its coordinates", () => {
    render(<LiveMap markers={markers} />);

    expect(
      screen.getAllByTestId("marker").map((node) => node.dataset.position),
    ).toEqual(["-34.6037,-58.3816", "-34.9011,-56.1645"]);
  });

  it("exposes the marker label as its title", () => {
    render(<LiveMap markers={markers} />);

    expect(screen.getByTitle("Unit 101")).toBeInTheDocument();
    expect(screen.getByTitle("Unit 201")).toBeInTheDocument();
  });

  it("carries the OpenStreetMap attribution", () => {
    render(<LiveMap markers={markers} />);

    expect(screen.getByTestId("tile-layer").dataset.attribution).toMatch(
      /openstreetmap/i,
    );
  });

  it("fits the viewport to every marker", () => {
    render(<LiveMap markers={markers} />);

    expect(mapSpies.fitBounds).toHaveBeenCalledWith(
      [
        [-34.6037, -58.3816],
        [-34.9011, -56.1645],
      ],
      expect.anything(),
    );
  });

  it("refits the viewport when the markers change", () => {
    const { rerender } = render(<LiveMap markers={markers} />);
    mapSpies.fitBounds.mockClear();

    rerender(<LiveMap markers={[markers[0]]} />);

    expect(mapSpies.fitBounds).toHaveBeenCalledWith(
      [[-34.6037, -58.3816]],
      expect.anything(),
    );
  });

  it("does not fit the viewport when there are no markers", () => {
    render(<LiveMap markers={[]} />);

    expect(mapSpies.fitBounds).not.toHaveBeenCalled();
  });
});

describe("LiveMap resize handling", () => {
  beforeEach(() => {
    mapSpies.invalidateSize.mockClear();
    resizeObserverSpies.observe.mockClear();
    resizeObserverSpies.disconnect.mockClear();
    resizeObserverSpies.callbacks.length = 0;
  });

  it("observes its own container", () => {
    render(<LiveMap markers={markers} />);

    expect(resizeObserverSpies.observe).toHaveBeenCalledTimes(1);
  });

  it("tells Leaflet to remeasure when the container resizes", () => {
    render(<LiveMap markers={markers} />);

    expect(mapSpies.invalidateSize).not.toHaveBeenCalled();

    resizeObserverSpies.callbacks.forEach((callback) =>
      callback([], {} as ResizeObserver),
    );

    expect(mapSpies.invalidateSize).toHaveBeenCalledWith({ animate: false });
  });

  it("stops observing when unmounted", () => {
    const { unmount } = render(<LiveMap markers={markers} />);

    unmount();

    expect(resizeObserverSpies.disconnect).toHaveBeenCalledTimes(1);
  });
});

describe("buildMarkerHtml", () => {
  it("passes the marker heading as a CSS custom property", () => {
    expect(buildMarkerHtml(markers[0])).toContain("--marker-rotation:90deg");
  });

  it("sets no rotation property when the heading is absent", () => {
    expect(buildMarkerHtml(markers[1])).not.toContain("style=");
  });

  it("styles the marker with classes rather than inline styles", () => {
    const html = buildMarkerHtml(markers[0]);

    expect(html).toContain('class="');
    expect(html.match(/style="[^"]*"/g)).toEqual([
      'style="--marker-rotation:90deg"',
    ]);
  });
});
