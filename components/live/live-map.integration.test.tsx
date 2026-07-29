import { render, screen } from "@testing-library/react";

import type { LiveMapMarker } from "@/application/live";

import { LiveMap } from "./live-map";

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

describe("LiveMap (unmocked Leaflet)", () => {
  it("displays the OpenStreetMap attribution to the user", () => {
    const { container } = render(<LiveMap markers={markers} />);

    const attribution = container.querySelector(".leaflet-control-attribution");

    expect(attribution).not.toBeNull();
    expect(attribution?.textContent).toMatch(/openstreetmap/i);
    expect(
      attribution?.querySelector('a[href*="openstreetmap.org/copyright"]'),
    ).not.toBeNull();
  });

  it("mounts a real map container", () => {
    const { container } = render(<LiveMap markers={markers} />);

    expect(container.querySelector(".leaflet-container")).not.toBeNull();
  });

  it("places one real marker per view model entry", () => {
    render(<LiveMap markers={markers} />);

    expect(screen.getByTitle("Unit 101")).toBeInTheDocument();
    expect(screen.getByTitle("Unit 201")).toBeInTheDocument();
  });

  it("rotates a marker that carries a heading and leaves the others upright", () => {
    const { container } = render(<LiveMap markers={markers} />);

    const icons = Array.from(container.querySelectorAll(".leaflet-marker-icon"));
    const rotated = icons.filter((icon) =>
      icon.innerHTML.includes("--marker-rotation:90deg"),
    );

    expect(icons).toHaveLength(2);
    expect(rotated).toHaveLength(1);
  });
});
