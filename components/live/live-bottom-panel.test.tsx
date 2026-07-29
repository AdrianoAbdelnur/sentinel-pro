import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { LiveBottomPanelViewModel } from "@/application/live";

import { LiveBottomPanel } from "./live-bottom-panel";

describe("LiveBottomPanel", () => {
  it("renders an unknown column key as its raw header", () => {
    const bottomPanel: LiveBottomPanelViewModel = {
      activeTab: "status",
      tabs: [
        {
          key: "status",
          columns: [{ key: "satelliteSignal" }],
          rows: [
            {
              vehicleId: "vehicle-1",
              cells: { satelliteSignal: "strong" },
            },
          ],
        },
      ],
    };

    render(
      <LiveBottomPanel
        bottomPanel={bottomPanel}
        vehicleLabels={{ "vehicle-1": "Unit 101" }}
        isCollapsed={false}
        onToggleCollapsed={vi.fn()}
        onTabChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("columnheader", { name: "satelliteSignal" }),
    ).toBeInTheDocument();
  });
});
