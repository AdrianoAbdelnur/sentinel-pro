import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { VEHICLE_STATUS_COPY } from "../live-copy";
import {
  ALL_STATUS_LABEL,
  LiveStatusFilterChips,
} from "./live-status-filter-chips";

describe("LiveStatusFilterChips", () => {
  it("renders one chip per status plus an all-statuses chip", () => {
    render(<LiveStatusFilterChips status="all" onStatusChange={vi.fn()} />);

    expect(
      screen.getByRole("button", { name: ALL_STATUS_LABEL }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: VEHICLE_STATUS_COPY["en-route"] }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: VEHICLE_STATUS_COPY.stopped }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: VEHICLE_STATUS_COPY.offline }),
    ).toBeInTheDocument();
  });

  it("keeps the status chips on one compact line", () => {
    render(<LiveStatusFilterChips status="all" onStatusChange={vi.fn()} />);

    expect(
      screen.getByRole("button", { name: ALL_STATUS_LABEL }).parentElement,
    ).toHaveClass("flex-nowrap");
  });

  it("marks the all-statuses chip pressed when the filter is all", () => {
    render(<LiveStatusFilterChips status="all" onStatusChange={vi.fn()} />);

    expect(
      screen.getByRole("button", { name: ALL_STATUS_LABEL }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: VEHICLE_STATUS_COPY["en-route"] }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("marks exactly one status chip pressed when a status is active", () => {
    render(<LiveStatusFilterChips status="stopped" onStatusChange={vi.fn()} />);

    expect(
      screen.getByRole("button", { name: ALL_STATUS_LABEL }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByRole("button", { name: VEHICLE_STATUS_COPY.stopped }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: VEHICLE_STATUS_COPY.offline }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByRole("button", { name: VEHICLE_STATUS_COPY["en-route"] }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("reports the clicked status", () => {
    const onStatusChange = vi.fn();
    render(<LiveStatusFilterChips status="all" onStatusChange={onStatusChange} />);

    fireEvent.click(
      screen.getByRole("button", { name: VEHICLE_STATUS_COPY.offline }),
    );

    expect(onStatusChange).toHaveBeenCalledWith("offline");
    expect(onStatusChange).toHaveBeenCalledTimes(1);
  });

  it("replaces the current value when clicking the all-statuses chip", () => {
    const onStatusChange = vi.fn();
    render(
      <LiveStatusFilterChips status="en-route" onStatusChange={onStatusChange} />,
    );

    fireEvent.click(screen.getByRole("button", { name: ALL_STATUS_LABEL }));

    expect(onStatusChange).toHaveBeenCalledWith("all");
  });

  it("replaces the current value rather than accumulating a set", () => {
    const onStatusChange = vi.fn();
    render(
      <LiveStatusFilterChips status="en-route" onStatusChange={onStatusChange} />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: VEHICLE_STATUS_COPY.stopped }),
    );

    expect(onStatusChange).toHaveBeenCalledTimes(1);
    expect(onStatusChange).toHaveBeenCalledWith("stopped");
  });
});
