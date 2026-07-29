import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

import type { LiveMapMarker } from "@/application/live";

const mapSpies = vi.hoisted(() => ({
  fitBounds: vi.fn(),
}));

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

describe("buildMarkerHtml", () => {
  it("passes the marker heading as a CSS custom property", () => {
    expect(buildMarkerHtml(markers[0])).toContain("--marker-rotation:90deg");
  });

  it("sets no rotation property when the heading is absent", () => {
    // The class always references the custom property with a 0deg fallback;
    // what must be absent is the style attribute that would define it.
    expect(buildMarkerHtml(markers[1])).not.toContain("style=");
  });

  it("styles the marker with classes rather than inline styles", () => {
    const html = buildMarkerHtml(markers[0]);

    expect(html).toContain('class="');
    // The rotation angle is the only value allowed through a style attribute.
    expect(html.match(/style="[^"]*"/g)).toEqual([
      'style="--marker-rotation:90deg"',
    ]);
  });
});
