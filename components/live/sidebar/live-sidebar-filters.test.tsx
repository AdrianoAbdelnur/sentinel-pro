import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { vi } from "vitest";

import { ALL_STATUS_LABEL } from "./live-status-filter-chips";
import { LiveSidebarFilters } from "./live-sidebar-filters";

function renderFilters(
  overrides: Partial<ComponentProps<typeof LiveSidebarFilters>> = {},
) {
  const onSearchChange = vi.fn();
  const onStatusChange = vi.fn();
  const onProviderChange = vi.fn();

  render(
    <LiveSidebarFilters
      searchTerm=""
      status="all"
      provider={undefined}
      availableProviders={["howen"]}
      onSearchChange={onSearchChange}
      onStatusChange={onStatusChange}
      onProviderChange={onProviderChange}
      {...overrides}
    />,
  );

  return { onSearchChange, onStatusChange, onProviderChange };
}

describe("LiveSidebarFilters", () => {
  it("lays out the search input, the provider control and the chip row", () => {
    renderFilters();

    expect(screen.getByRole("searchbox")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: ALL_STATUS_LABEL }),
    ).toBeInTheDocument();
  });

  it("shows the current search term", () => {
    renderFilters({ searchTerm: "unit 101" });

    expect(screen.getByRole("searchbox")).toHaveValue("unit 101");
  });

  it("reports search input changes upward, unmodified", () => {
    const { onSearchChange } = renderFilters();

    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "unit 101" },
    });

    expect(onSearchChange).toHaveBeenCalledWith("unit 101");
  });

  it("delegates status changes to the caller", () => {
    const { onStatusChange } = renderFilters();

    fireEvent.click(screen.getByRole("button", { name: /en ruta/i }));

    expect(onStatusChange).toHaveBeenCalledWith("en-route");
  });

  it("delegates provider changes to the caller", () => {
    const { onProviderChange } = renderFilters({
      availableProviders: ["howen"],
    });

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "howen" },
    });

    expect(onProviderChange).toHaveBeenCalledWith("howen");
  });
});
