import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

import type { LiveVehicleNode } from "@/application/live";

import { VEHICLE_STATUS_COPY } from "../live-copy";
import { LiveVehicleRow } from "./live-vehicle-row";

const baseVehicle: LiveVehicleNode = {
  vehicleId: "vehicle-101",
  plate: "ABC123",
  label: "Unit 101",
  status: "en-route",
  speedKmH: 46,
  lastReportAt: "2026-07-29T12:03:00.000Z",
  provider: "howen",
  isSelected: false,
  hasValidGps: true,
  canOpenLive: true,
};

describe("LiveVehicleRow", () => {
  it("renders the label as the headline and the plate beneath it", () => {
    render(<LiveVehicleRow vehicle={baseVehicle} onToggle={vi.fn()} />);

    expect(screen.getByText("Unit 101")).toBeInTheDocument();
    expect(screen.getByText("ABC123")).toBeInTheDocument();
  });

  it("uses the label as the headline when there is no plate", () => {
    const vehicle: LiveVehicleNode = { ...baseVehicle, plate: undefined };
    render(<LiveVehicleRow vehicle={vehicle} onToggle={vi.fn()} />);

    expect(screen.getAllByText("Unit 101")).toHaveLength(1);
  });

  it("renders only the plate when the label is absent", () => {
    const vehicle: LiveVehicleNode = { ...baseVehicle, label: undefined };
    render(<LiveVehicleRow vehicle={vehicle} onToggle={vi.fn()} />);

    expect(screen.getByText("ABC123")).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "ABC123" }),
    ).toBeInTheDocument();
  });

  it("renders the missing-value marker when no visible identifier is available", () => {
    const vehicle: LiveVehicleNode = {
      ...baseVehicle,
      label: undefined,
      plate: undefined,
    };
    render(<LiveVehicleRow vehicle={vehicle} onToggle={vi.fn()} />);

    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "—" })).toBeInTheDocument();
  });

  it("renders the status badge with the Spanish word for the status", () => {
    render(<LiveVehicleRow vehicle={baseVehicle} onToggle={vi.fn()} />);

    expect(
      screen.getByText(VEHICLE_STATUS_COPY["en-route"]),
    ).toBeInTheDocument();
  });

  it("renders the reported speed", () => {
    render(<LiveVehicleRow vehicle={baseVehicle} onToggle={vi.fn()} />);

    expect(screen.getByText(/46 km\/h/)).toBeInTheDocument();
  });

  it("renders the last report time as an absolute HH:mm inside a <time> element", () => {
    render(<LiveVehicleRow vehicle={baseVehicle} onToggle={vi.fn()} />);

    const timeElement = screen.getByText("09:03");
    expect(timeElement.tagName).toBe("TIME");
    expect(timeElement).toHaveAttribute(
      "dateTime",
      "2026-07-29T12:03:00.000Z",
    );
    expect(timeElement).toHaveAttribute("title");
  });

  it("renders the provider badge", () => {
    render(<LiveVehicleRow vehicle={baseVehicle} onToggle={vi.fn()} />);

    expect(screen.getByText("howen")).toBeInTheDocument();
  });

  it("renders no provider badge when the vehicle has no device", () => {
    const vehicle: LiveVehicleNode = { ...baseVehicle, provider: undefined };
    render(<LiveVehicleRow vehicle={vehicle} onToggle={vi.fn()} />);

    expect(screen.queryByText("howen")).not.toBeInTheDocument();
  });

  it("shows the missing-value fallback for an offline vehicle's speed, never a stale number", () => {
    const vehicle: LiveVehicleNode = {
      ...baseVehicle,
      status: "offline",
      speedKmH: undefined,
    };
    render(<LiveVehicleRow vehicle={vehicle} onToggle={vi.fn()} />);

    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText(/km\/h/)).not.toBeInTheDocument();
  });

  it("shows the missing-value fallback when there is no last report", () => {
    const vehicle: LiveVehicleNode = { ...baseVehicle, lastReportAt: undefined };
    const { container } = render(
      <LiveVehicleRow vehicle={vehicle} onToggle={vi.fn()} />,
    );

    expect(container.querySelector("time")).not.toBeInTheDocument();
    expect(screen.getByText(/46 km\/h/)).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("names the checkbox after the label and the plate", () => {
    render(<LiveVehicleRow vehicle={baseVehicle} onToggle={vi.fn()} />);

    expect(
      screen.getByRole("checkbox", { name: "Unit 101 · ABC123" }),
    ).toBeInTheDocument();
  });

  it("names the checkbox after the label alone when there is no plate", () => {
    const vehicle: LiveVehicleNode = { ...baseVehicle, plate: undefined };
    render(<LiveVehicleRow vehicle={vehicle} onToggle={vi.fn()} />);

    expect(
      screen.getByRole("checkbox", { name: "Unit 101" }),
    ).toBeInTheDocument();
  });

  it("reflects the selection state on the checkbox", () => {
    const vehicle: LiveVehicleNode = { ...baseVehicle, isSelected: true };
    render(<LiveVehicleRow vehicle={vehicle} onToggle={vi.fn()} />);

    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("reports the vehicle id when the checkbox is toggled", () => {
    const onToggle = vi.fn();
    render(<LiveVehicleRow vehicle={baseVehicle} onToggle={onToggle} />);

    fireEvent.click(screen.getByRole("checkbox"));

    expect(onToggle).toHaveBeenCalledWith("vehicle-101");
  });
});
