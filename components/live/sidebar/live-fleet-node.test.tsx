import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

import type { LiveFleetNode as LiveFleetNodeViewModel } from "@/application/live";

import { LiveFleetNode } from "./live-fleet-node";

const vehicle101 = {
  vehicleId: "vehicle-101",
  plate: "ABC123",
  label: "Unit 101",
  status: "en-route" as const,
  speedKmH: 46,
  lastReportAt: "2026-07-29T12:03:00.000Z",
  provider: "howen",
  isSelected: false,
  hasValidGps: true,
  canOpenLive: true,
};

const vehicle102 = {
  vehicleId: "vehicle-102",
  label: "Unit 102",
  status: "offline" as const,
  isSelected: false,
  hasValidGps: false,
  canOpenLive: false,
};

function buildFleet(
  overrides: Partial<LiveFleetNodeViewModel> = {},
): LiveFleetNodeViewModel {
  return {
    fleetId: "fleet-north",
    label: "North Fleet",
    isExpanded: false,
    isSelected: false,
    counts: { online: 1, total: 13 },
    vehicles: [vehicle101, vehicle102],
    ...overrides,
  };
}

function renderNode(overrides: Partial<LiveFleetNodeViewModel> = {}) {
  return render(
    <ul>
      <LiveFleetNode
        fleet={buildFleet(overrides)}
        onToggleExpanded={vi.fn()}
        onToggleFleet={vi.fn()}
        onToggleVehicle={vi.fn()}
      />
    </ul>,
  );
}

describe("LiveFleetNode", () => {
  it("renders the fleet label", () => {
    renderNode();

    expect(screen.getByText("North Fleet")).toBeInTheDocument();
  });

  it("keeps a long mixed-case fleet label compact on one truncated line", () => {
    const label = "AB Construcciones (Río Segundo)";
    renderNode({ label });

    const fleetLabel = screen.getByText(label);

    expect(fleetLabel).toHaveClass("truncate", "text-xs");
    expect(fleetLabel).not.toHaveClass("uppercase", "tracking-[0.14em]");
    expect(fleetLabel).toHaveTextContent(label);
  });

  it("renders the online/total counts", () => {
    renderNode({ counts: { online: 1, total: 13 } });

    const counts = screen.getByLabelText(/1 de 13 vehículos en línea/i);
    expect(counts).toHaveTextContent("1/13");
  });

  it("gives the counts cluster a Spanish accessible label", () => {
    renderNode({ counts: { online: 1, total: 13 } });

    expect(screen.getByLabelText(/1 de 13 vehículos en línea/i)).toBeInTheDocument();
  });

  it("keeps the header sticky at the top of the scroll region", () => {
    renderNode();

    const header = screen.getByText("North Fleet").closest("div");
    expect(header?.className).toContain("sticky");
  });

  it("does not show a visible count when nothing narrows the list", () => {
    renderNode({ vehicles: [vehicle101] });

    expect(screen.queryByText(/visible/i)).not.toBeInTheDocument();
  });

  it("does not add a redundant visible count when a filter narrows the list", () => {
    renderNode({ vehicles: [vehicle101], counts: { online: 1, total: 13 } });

    expect(screen.queryByText(/1 visible/i)).not.toBeInTheDocument();
  });

  it("reflects the expanded state and toggles it", () => {
    const onToggleExpanded = vi.fn();
    render(
      <ul>
        <LiveFleetNode
          fleet={buildFleet({ isExpanded: false })}
          onToggleExpanded={onToggleExpanded}
          onToggleFleet={vi.fn()}
          onToggleVehicle={vi.fn()}
        />
      </ul>,
    );

    const toggle = screen.getByRole("button", { name: /North Fleet/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(toggle);
    expect(onToggleExpanded).toHaveBeenCalledWith("fleet-north");
  });

  it("does not render vehicles while collapsed", () => {
    renderNode({ isExpanded: false });

    expect(screen.queryByText("Unit 101")).not.toBeInTheDocument();
  });

  it("renders its vehicles as rows while expanded", () => {
    renderNode({ isExpanded: true });

    expect(
      screen.getByRole("checkbox", { name: "ABC123 · Unit 101" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Unit 102" }),
    ).toBeInTheDocument();
  });

  it("indents vehicle rows beneath the fleet header", () => {
    renderNode({ isExpanded: true });

    const vehicleList = screen
      .getByRole("checkbox", { name: "ABC123 · Unit 101" })
      .closest("ul");

    expect(vehicleList).toHaveClass("ml-4", "border-l");
  });

  it("gives the select-all checkbox a Spanish accessible name and reports the fleet id", () => {
    const onToggleFleet = vi.fn();
    render(
      <ul>
        <LiveFleetNode
          fleet={buildFleet()}
          onToggleExpanded={vi.fn()}
          onToggleFleet={onToggleFleet}
          onToggleVehicle={vi.fn()}
        />
      </ul>,
    );

    const selectAll = screen.getByRole("checkbox", {
      name: /Seleccionar todos los vehículos de North Fleet/i,
    });
    fireEvent.click(selectAll);

    expect(onToggleFleet).toHaveBeenCalledWith("fleet-north");
  });

  it("forwards vehicle toggles from a row", () => {
    const onToggleVehicle = vi.fn();
    render(
      <ul>
        <LiveFleetNode
          fleet={buildFleet({ isExpanded: true })}
          onToggleExpanded={vi.fn()}
          onToggleFleet={vi.fn()}
          onToggleVehicle={onToggleVehicle}
        />
      </ul>,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Unit 102" }));

    expect(onToggleVehicle).toHaveBeenCalledWith("vehicle-102");
  });
});
