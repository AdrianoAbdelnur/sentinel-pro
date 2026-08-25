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
  {
    isCollapsed = false,
    onToggleCollapsed = vi.fn(),
    pagination,
    onPageChange,
  }: {
    isCollapsed?: boolean;
    onToggleCollapsed?: () => void;
    pagination?: { page: number; totalPages: number };
    onPageChange?: (page: number) => void;
  } = {},
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
      pagination={pagination}
      onPageChange={onPageChange}
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
  it("keeps controls fixed while only the fleet-list region owns vertical scrolling", () => {
    const { container } = renderSidebar({
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

    const shell = container.querySelector("aside");
    const listRegion = container.querySelector(".overflow-y-auto");
    const searchbox = screen.getByRole("searchbox");

    expect(shell).toHaveClass("w-72");
    expect(shell).not.toHaveClass("overflow-y-auto");
    expect(listRegion).toBeInTheDocument();
    expect(listRegion).toHaveClass("min-h-0", "flex-1", "overflow-y-auto");
    expect(listRegion).not.toContainElement(searchbox);
  });

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

  it("keeps the pagination controller in a visible footer below the scrolling list", () => {
    const onPageChange = vi.fn();
    const { container } = renderSidebar(
      {
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
      },
      { pagination: { page: 1, totalPages: 1 }, onPageChange },
    );

    const listRegion = container.querySelector(".overflow-y-auto");
    const footer = screen.getByRole("navigation", { name: "Paginación de vehículos" });
    const previous = screen.getByRole("button", { name: "Página anterior" });
    const next = screen.getByRole("button", { name: "Página siguiente" });

    expect(listRegion).not.toContainElement(footer);
    expect(footer).toHaveClass("shrink-0");
    expect(previous).toBeDisabled();
    expect(next).toBeDisabled();
    expect(footer).toHaveTextContent("1 de 1");

    fireEvent.click(next);
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it("shows five selectable pages and jumps by ten pages", () => {
    const onPageChange = vi.fn();
    renderSidebar({}, { pagination: { page: 3, totalPages: 90 }, onPageChange });

    expect(screen.getByRole("button", { name: "Ir a la página 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ir a la página 5" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ir a la página 6" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ir a la página 5" }));
    expect(onPageChange).toHaveBeenCalledWith(5);

    fireEvent.click(screen.getByRole("button", { name: "Avanzar 10 páginas" }));
    expect(onPageChange).toHaveBeenCalledWith(13);
  });
});
