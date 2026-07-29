import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

import type { LiveSidebarViewModel } from "@/application/live";

import {
  COLLAPSE_SIDEBAR_LABEL,
  EMPTY_FLEETS_LABEL,
  EXPAND_SIDEBAR_LABEL,
  LiveSidebar,
} from "./live-sidebar";

function buildSidebar(
  overrides: Partial<LiveSidebarViewModel> = {},
): LiveSidebarViewModel {
  return {
    search: { term: "" },
    filters: {
      status: "all",
      provider: undefined,
      availableProviders: [],
      isNarrowed: false,
    },
    fleets: [],
    ...overrides,
  };
}

function renderSidebar(
  overrides: Partial<LiveSidebarViewModel> = {},
  { isCollapsed = false, onToggleCollapsed = vi.fn() } = {},
) {
  return render(
    <LiveSidebar
      sidebar={buildSidebar(overrides)}
      isCollapsed={isCollapsed}
      onToggleCollapsed={onToggleCollapsed}
      onSearchChange={vi.fn()}
      onStatusChange={vi.fn()}
      onProviderChange={vi.fn()}
      onToggleExpanded={vi.fn()}
      onToggleFleet={vi.fn()}
      onToggleVehicle={vi.fn()}
    />,
  );
}

describe("LiveSidebar collapse", () => {
  const fleets = [
    {
      fleetId: "fleet-north",
      label: "North Fleet",
      isExpanded: false,
      isSelected: false,
      counts: { online: 1, total: 2 },
      vehicles: [],
    },
  ];

  it("hides the fleet list and the filters while collapsed", () => {
    renderSidebar({ fleets }, { isCollapsed: true });

    expect(screen.queryByText("North Fleet")).not.toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });

  it("offers a way back out while collapsed", () => {
    const onToggleCollapsed = vi.fn();
    renderSidebar({ fleets }, { isCollapsed: true, onToggleCollapsed });

    fireEvent.click(
      screen.getByRole("button", { name: EXPAND_SIDEBAR_LABEL }),
    );

    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
  });

  it("offers a way to collapse while expanded", () => {
    const onToggleCollapsed = vi.fn();
    renderSidebar({ fleets }, { onToggleCollapsed });

    fireEvent.click(
      screen.getByRole("button", { name: COLLAPSE_SIDEBAR_LABEL }),
    );

    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
  });
});

describe("LiveSidebar", () => {
  it("shows a Spanish empty state when no fleet matches", () => {
    renderSidebar({ fleets: [] });

    expect(screen.getByText(EMPTY_FLEETS_LABEL)).toBeInTheDocument();
  });

  it("does not show the empty state when there are fleets", () => {
    renderSidebar({
      fleets: [
        {
          fleetId: "fleet-north",
          label: "North Fleet",
          isExpanded: false,
          isSelected: false,
          counts: { online: 1, total: 2 },
          vehicles: [],
        },
      ],
    });

    expect(screen.queryByText(EMPTY_FLEETS_LABEL)).not.toBeInTheDocument();
    expect(screen.getByText("North Fleet")).toBeInTheDocument();
  });
});
