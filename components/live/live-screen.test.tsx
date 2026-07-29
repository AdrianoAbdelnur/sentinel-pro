import { fireEvent, render, screen, within } from "@testing-library/react";
import { vi } from "vitest";

import * as liveApplication from "@/application/live";
import {
  buildLivePageViewModel,
  type LiveBottomPanelTab,
  type LiveState,
} from "@/application/live";

vi.mock("./live-map", () => ({
  LiveMap: ({ markers }: { markers: { vehicleId: string }[] }) => (
    <div data-testid="live-map-stub" data-marker-count={markers.length} />
  ),
}));

import {
  BOTTOM_PANEL_EMPTY_STATE_COPY,
  BOTTOM_PANEL_TAB_COPY,
  MAP_EMPTY_STATE_COPY,
  PLAYBACK_NOTICE_COPY,
  VEHICLE_STATUS_COPY,
} from "./live-copy";
import {
  COLLAPSE_BOTTOM_PANEL_LABEL,
  EXPAND_BOTTOM_PANEL_LABEL,
} from "./live-bottom-panel";
import { LiveScreen } from "./live-screen";
import { ALL_STATUS_LABEL } from "./sidebar/live-status-filter-chips";
import {
  COLLAPSE_SIDEBAR_LABEL,
  EXPAND_SIDEBAR_LABEL,
} from "./sidebar/live-sidebar";

const liveState: LiveState = {
  fleets: [
    {
      fleetId: "fleet-north",
      label: "North Fleet",
      vehicleIds: ["vehicle-101", "vehicle-102"],
    },
    {
      fleetId: "fleet-south",
      label: "South Fleet",
      vehicleIds: ["vehicle-201"],
    },
  ],
  liveVehicles: [
    {
      vehicle: {
        id: "vehicle-101",
        customerId: "customer-1",
        fleetId: "fleet-north",
        label: "Unit 101",
        plate: "ABC123",
        isActive: true,
      },
      device: {
        id: "device-101",
        vehicleId: "vehicle-101",
        provider: "demo",
        origin: "local",
        kind: "mdvr",
        isActive: true,
      },
      telemetry: {
        deviceId: "device-101",
        online: true,
        latitude: -34.6,
        longitude: -58.4,
      },
    },
    {
      vehicle: {
        id: "vehicle-102",
        customerId: "customer-1",
        fleetId: "fleet-north",
        label: "Unit 102",
        plate: "XYZ789",
        isActive: true,
      },
      telemetry: { deviceId: "device-102", online: false },
    },
    {
      vehicle: {
        id: "vehicle-201",
        customerId: "customer-1",
        fleetId: "fleet-south",
        label: "Unit 201",
        plate: "DEF456",
        isActive: false,
      },
      telemetry: { deviceId: "device-201", online: false },
    },
  ],
};

const NOW = Date.parse("2026-07-29T12:00:00.000Z");
const STALE_AFTER_MS = 5 * 60 * 1000;

const tabs: LiveBottomPanelTab[] = [
  {
    key: "status",
    columns: [{ key: "speed" }, { key: "ignition" }],
    rows: [{ vehicleId: "vehicle-101", cells: { speed: 46 } }],
  },
  {
    key: "event",
    columns: [{ key: "lastEvent" }],
    rows: [{ vehicleId: "vehicle-101", cells: { lastEvent: "Harsh braking" } }],
  },
];

function renderScreen() {
  return render(
    <LiveScreen
      liveState={liveState}
      tabs={tabs}
      nowMs={NOW}
      staleAfterMs={STALE_AFTER_MS}
    />,
  );
}

function fleetToggle(label: string) {
  return screen.getByRole("button", { name: new RegExp(label, "i") });
}

function vehicleCheckbox(label: string) {
  return screen.getByRole("checkbox", { name: new RegExp(label, "i") });
}

describe("LiveScreen layout", () => {
  it("keeps the map mounted with nothing selected", () => {
    renderScreen();

    expect(
      screen.getByRole("region", { name: /mapa en vivo/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(MAP_EMPTY_STATE_COPY["no-selection"]),
    ).toBeInTheDocument();
  });

  it("collapses and restores the sidebar independently", () => {
    renderScreen();

    fireEvent.click(
      screen.getByRole("button", { name: COLLAPSE_SIDEBAR_LABEL }),
    );
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: /mapa en vivo/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tablist")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: EXPAND_SIDEBAR_LABEL }),
    );
    expect(screen.getByRole("searchbox")).toBeInTheDocument();
  });

  it("collapses and restores the bottom panel independently", () => {
    renderScreen();

    fireEvent.click(
      screen.getByRole("button", { name: COLLAPSE_BOTTOM_PANEL_LABEL }),
    );
    expect(
      screen.queryByText(BOTTOM_PANEL_EMPTY_STATE_COPY["no-selection"]),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.getByRole("searchbox")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: EXPAND_BOTTOM_PANEL_LABEL }),
    );
    expect(
      screen.getByText(BOTTOM_PANEL_EMPTY_STATE_COPY["no-selection"]),
    ).toBeInTheDocument();
  });
});

describe("LiveScreen", () => {
  it("renders every fleet", () => {
    renderScreen();

    expect(fleetToggle("North Fleet")).toBeInTheDocument();
    expect(fleetToggle("South Fleet")).toBeInTheDocument();
  });

  it("keeps fleets collapsed on first render", () => {
    renderScreen();

    expect(screen.queryByText("Unit 101")).not.toBeInTheDocument();
  });

  it("reveals the vehicles of an expanded fleet", () => {
    renderScreen();

    fireEvent.click(fleetToggle("North Fleet"));

    expect(screen.getByText("Unit 101")).toBeInTheDocument();
    expect(screen.getByText("Unit 102")).toBeInTheDocument();
  });

  it("shows the empty state until a vehicle is selected", () => {
    renderScreen();

    expect(
      screen.getByText(BOTTOM_PANEL_EMPTY_STATE_COPY["no-selection"]),
    ).toBeInTheDocument();
  });

  it("adds a row to the bottom panel when a vehicle is selected", () => {
    renderScreen();
    fireEvent.click(fleetToggle("North Fleet"));

    fireEvent.click(vehicleCheckbox("Unit 101"));

    const table = screen.getByRole("table");
    expect(within(table).getByText("Unit 101")).toBeInTheDocument();
    expect(within(table).getByText("46")).toBeInTheDocument();
    expect(
      screen.queryByText(BOTTOM_PANEL_EMPTY_STATE_COPY["no-selection"]),
    ).not.toBeInTheDocument();
  });

  it("renders a fallback marker for missing cell values", () => {
    renderScreen();
    fireEvent.click(fleetToggle("North Fleet"));
    fireEvent.click(vehicleCheckbox("Unit 101"));

    const row = screen.getByRole("row", { name: /unit 101/i });
    expect(within(row).getByText("—")).toBeInTheDocument();
  });

  it("selects every vehicle of a fleet from the fleet checkbox", () => {
    renderScreen();
    fireEvent.click(fleetToggle("North Fleet"));

    fireEvent.click(
      vehicleCheckbox("Seleccionar todos los vehículos de North Fleet"),
    );

    expect(vehicleCheckbox("Unit 101")).toBeChecked();
    expect(vehicleCheckbox("Unit 102")).toBeChecked();
  });

  it("narrows the rendered fleets when searching by plate", () => {
    renderScreen();

    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "DEF456" },
    });

    expect(screen.queryByText("North Fleet")).not.toBeInTheDocument();
    expect(screen.getByText("South Fleet")).toBeInTheDocument();
    expect(screen.getByText("Unit 201")).toBeInTheDocument();
  });

  it("narrows to vehicles matching the selected status chip", () => {
    renderScreen();

    fireEvent.click(
      screen.getByRole("button", { name: VEHICLE_STATUS_COPY.stopped }),
    );

    expect(screen.getByText("Unit 101")).toBeInTheDocument();
    expect(screen.queryByText("Unit 102")).not.toBeInTheDocument();
    expect(screen.queryByText("South Fleet")).not.toBeInTheDocument();
  });

  it("narrows to vehicles matching the selected provider", () => {
    renderScreen();

    fireEvent.change(screen.getByRole("combobox", { name: /proveedor/i }), {
      target: { value: "demo" },
    });

    expect(screen.getByText("Unit 101")).toBeInTheDocument();
    expect(screen.queryByText("Unit 102")).not.toBeInTheDocument();
    expect(screen.queryByText("South Fleet")).not.toBeInTheDocument();
  });

  it("returns to the full roster when the status filter is reset to Todos", () => {
    renderScreen();

    fireEvent.click(
      screen.getByRole("button", { name: VEHICLE_STATUS_COPY.stopped }),
    );
    fireEvent.click(screen.getByRole("button", { name: ALL_STATUS_LABEL }));

    expect(screen.getByText("North Fleet")).toBeInTheDocument();
    expect(screen.getByText("South Fleet")).toBeInTheDocument();
  });

  it("shows the map empty state while nothing is selected", () => {
    renderScreen();

    expect(
      screen.getByText(MAP_EMPTY_STATE_COPY["no-selection"]),
    ).toBeInTheDocument();
  });

  it("does not render a playback notice before the playback monitor exists", () => {
    const pageWithNotice = buildLivePageViewModel({
      liveState,
      selectedVehicleIds: [],
      searchTerm: "",
      activeTab: "status",
      tabs,
      nowMs: NOW,
      staleAfterMs: STALE_AFTER_MS,
      playback: {
        isOpen: false,
        notice: { code: "vehicle-offline" },
      },
    });
    const buildPageSpy = vi
      .spyOn(liveApplication, "buildLivePageViewModel")
      .mockReturnValueOnce(pageWithNotice);

    renderScreen();

    expect(buildPageSpy).toHaveBeenCalled();
    expect(
      screen.queryByText(PLAYBACK_NOTICE_COPY["vehicle-offline"]),
    ).not.toBeInTheDocument();

    buildPageSpy.mockRestore();
  });

  it("replaces the map empty state once a mappable vehicle is selected", () => {
    renderScreen();
    fireEvent.click(fleetToggle("North Fleet"));

    fireEvent.click(vehicleCheckbox("Unit 101"));

    expect(
      screen.queryByText(MAP_EMPTY_STATE_COPY["no-selection"]),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: /mapa en vivo/i }),
    ).toBeInTheDocument();
  });

  it("keeps the selection when the active tab changes", () => {
    renderScreen();
    fireEvent.click(fleetToggle("North Fleet"));
    fireEvent.click(vehicleCheckbox("Unit 101"));

    fireEvent.click(
      screen.getByRole("tab", { name: BOTTOM_PANEL_TAB_COPY.event }),
    );

    const table = screen.getByRole("table");
    expect(within(table).getByText("Unit 101")).toBeInTheDocument();
    expect(within(table).getByText("Harsh braking")).toBeInTheDocument();
    expect(vehicleCheckbox("Unit 101")).toBeChecked();
  });
});
