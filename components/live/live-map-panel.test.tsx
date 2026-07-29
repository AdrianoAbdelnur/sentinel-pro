import { render, screen } from "@testing-library/react";

import type { LiveMapViewModel } from "@/application/live";

import { MAP_EMPTY_STATE_COPY } from "./live-copy";
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
  it("renders the map region when there are markers", () => {
    renderPanel({ markers });

    expect(
      screen.getByRole("region", { name: /mapa en vivo/i }),
    ).toBeInTheDocument();
  });

  it("keeps the map region mounted while the no-selection state is active", () => {
    renderPanel({
      markers: [],
      emptyState: { code: "no-selection" },
    });

    expect(
      screen.getByRole("region", { name: /mapa en vivo/i }),
    ).toBeInTheDocument();
  });

  it("keeps the map region mounted while the no-mappable-selection state is active", () => {
    renderPanel({
      markers: [],
      emptyState: { code: "no-mappable-selection" },
    });

    expect(
      screen.getByRole("region", { name: /mapa en vivo/i }),
    ).toBeInTheDocument();
  });

  it("overlays the no-selection notice on top of the map", () => {
    renderPanel({
      markers: [],
      emptyState: { code: "no-selection" },
    });

    expect(
      screen.getByText(MAP_EMPTY_STATE_COPY["no-selection"]),
    ).toBeInTheDocument();
  });

  it("overlays the no-mappable-selection notice on top of the map", () => {
    renderPanel({
      markers: [],
      emptyState: { code: "no-mappable-selection" },
    });

    expect(
      screen.getByText(MAP_EMPTY_STATE_COPY["no-mappable-selection"]),
    ).toBeInTheDocument();
  });

  it("shows no notice once there is something to plot", () => {
    renderPanel({ markers });

    expect(screen.queryByText(MAP_EMPTY_STATE_COPY["no-selection"])).toBeNull();
    expect(
      screen.queryByText(MAP_EMPTY_STATE_COPY["no-mappable-selection"]),
    ).toBeNull();
  });

  it("still shows the notice when an empty state arrives alongside markers", () => {
    renderPanel({
      markers,
      emptyState: { code: "no-selection" },
    });

    expect(
      screen.getByRole("region", { name: /mapa en vivo/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(MAP_EMPTY_STATE_COPY["no-selection"]),
    ).toBeInTheDocument();
  });
});
