import { render, screen } from "@testing-library/react";

import type { LiveMapViewModel } from "@/application/live";

import { LiveMapPanel } from "./live-map-panel";

const markers = [
  {
    vehicleId: "vehicle-101",
    label: "Unit 101",
    latitude: -34.6037,
    longitude: -58.3816,
  },
];

function renderPanel(map: LiveMapViewModel) {
  return render(<LiveMapPanel map={map} />);
}

describe("LiveMapPanel", () => {
  it("shows the no-selection message without rendering a map", () => {
    renderPanel({
      markers: [],
      emptyState: {
        code: "no-selection",
        message: "Select at least one vehicle to view it on the map.",
      },
    });

    expect(
      screen.getByText("Select at least one vehicle to view it on the map."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /live map/i })).toBeNull();
  });

  it("shows the no-mappable-selection message without rendering a map", () => {
    renderPanel({
      markers: [],
      emptyState: {
        code: "no-mappable-selection",
        message: "The selected vehicles do not have valid GPS coordinates.",
      },
    });

    expect(
      screen.getByText(
        "The selected vehicles do not have valid GPS coordinates.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /live map/i })).toBeNull();
  });

  it("renders the map region when there are markers", () => {
    renderPanel({ markers });

    expect(screen.getByRole("region", { name: /live map/i })).toBeInTheDocument();
  });

  it("prefers the empty state even if markers are present", () => {
    renderPanel({
      markers,
      emptyState: {
        code: "no-selection",
        message: "Select at least one vehicle to view it on the map.",
      },
    });

    expect(screen.queryByRole("region", { name: /live map/i })).toBeNull();
  });
});
