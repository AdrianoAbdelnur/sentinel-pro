import { fireEvent, render, screen, within } from "@testing-library/react";
import { vi } from "vitest";

import type { LiveBottomPanelTab, LiveState } from "@/application/live";

// Leaflet cannot run under jsdom. These tests are about screen behavior, so the
// map is replaced by a stub; the real map is covered by live-map.test.tsx.
vi.mock("./live-map", () => ({
  LiveMap: ({ markers }: { markers: { vehicleId: string }[] }) => (
    <div data-testid="live-map-stub" data-marker-count={markers.length} />
  ),
}));

import { LiveScreen } from "./live-screen";

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
        isActive: true,
      },
      telemetry: { deviceId: "device-201", online: true },
    },
  ],
};

const tabs: LiveBottomPanelTab[] = [
  {
    key: "status",
    label: "Status",
    columns: [
      { key: "speed", label: "Speed" },
      { key: "ignition", label: "Ignition" },
    ],
    rows: [{ vehicleId: "vehicle-101", cells: { speed: 46 } }],
  },
  {
    key: "event",
    label: "Event",
    columns: [{ key: "lastEvent", label: "Last event" }],
    rows: [{ vehicleId: "vehicle-101", cells: { lastEvent: "Harsh braking" } }],
  },
];

function renderScreen() {
  return render(<LiveScreen liveState={liveState} tabs={tabs} />);
}

function fleetToggle(label: string) {
  return screen.getByRole("button", { name: new RegExp(label, "i") });
}

function vehicleCheckbox(label: string) {
  return screen.getByRole("checkbox", { name: new RegExp(label, "i") });
}

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
      screen.getByText(/select at least one vehicle to view its data/i),
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
      screen.queryByText(/select at least one vehicle to view its data/i),
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

    fireEvent.click(vehicleCheckbox("Select all vehicles in North Fleet"));

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

  it("shows the map empty state while nothing is selected", () => {
    renderScreen();

    expect(
      screen.getByText(/select at least one vehicle to view it on the map/i),
    ).toBeInTheDocument();
  });

  it("replaces the map empty state once a mappable vehicle is selected", () => {
    renderScreen();
    fireEvent.click(fleetToggle("North Fleet"));

    fireEvent.click(vehicleCheckbox("Unit 101"));

    expect(
      screen.queryByText(/select at least one vehicle to view it on the map/i),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: /live map/i })).toBeInTheDocument();
  });

  it("keeps the selection when the active tab changes", () => {
    renderScreen();
    fireEvent.click(fleetToggle("North Fleet"));
    fireEvent.click(vehicleCheckbox("Unit 101"));

    fireEvent.click(screen.getByRole("tab", { name: "Event" }));

    const table = screen.getByRole("table");
    expect(within(table).getByText("Unit 101")).toBeInTheDocument();
    expect(within(table).getByText("Harsh braking")).toBeInTheDocument();
    expect(vehicleCheckbox("Unit 101")).toBeChecked();
  });
});
