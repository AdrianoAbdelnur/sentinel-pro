import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { DrivingIndexVehicleRow } from "@/application/driving-index/contracts";

import { VehicleMeasurementTable } from "./vehicle-measurement-table";

const vehicles: DrivingIndexVehicleRow[] = [
  { canonicalPlate: "AAA111", displayPlate: "aaa-111", plateFormat: "legacy" },
  { canonicalPlate: "BB222CC", displayPlate: "BB222CC", plateFormat: "mercosur" },
];

describe("VehicleMeasurementTable", () => {
  it("renders one row per vehicle with its display plate", () => {
    render(
      <VehicleMeasurementTable
        vehicles={vehicles}
        realKilometersByPlate={{}}
        plannedKilometers=""
        onRealKilometersChange={vi.fn()}
        onPlannedKilometersChange={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("row")).toHaveLength(3);
    expect(screen.getByText("aaa-111")).toBeInTheDocument();
    expect(screen.getByText("BB222CC")).toBeInTheDocument();
  });

  it("renders one KP input for the whole period, not one per row", () => {
    render(
      <VehicleMeasurementTable
        vehicles={vehicles}
        realKilometersByPlate={{}}
        plannedKilometers="150"
        onRealKilometersChange={vi.fn()}
        onPlannedKilometersChange={vi.fn()}
      />,
    );

    const kpInputs = screen.getAllByLabelText("KP del período");
    expect(kpInputs).toHaveLength(1);
    expect(kpInputs[0]).toHaveValue(150);
  });

  it("reflects the KR value for each row from props, keyed by canonical plate", () => {
    render(
      <VehicleMeasurementTable
        vehicles={vehicles}
        realKilometersByPlate={{ AAA111: "80", BB222CC: "42" }}
        plannedKilometers=""
        onRealKilometersChange={vi.fn()}
        onPlannedKilometersChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("KR de aaa-111")).toHaveValue(80);
    expect(screen.getByLabelText("KR de BB222CC")).toHaveValue(42);
  });

  it("reports a KR change keyed by the row's canonical plate", () => {
    const onRealKilometersChange = vi.fn();
    render(
      <VehicleMeasurementTable
        vehicles={vehicles}
        realKilometersByPlate={{}}
        plannedKilometers=""
        onRealKilometersChange={onRealKilometersChange}
        onPlannedKilometersChange={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("KR de aaa-111"), { target: { value: "99" } });

    expect(onRealKilometersChange).toHaveBeenCalledWith("AAA111", "99");
  });

  it("reports a KP change once for the period", () => {
    const onPlannedKilometersChange = vi.fn();
    render(
      <VehicleMeasurementTable
        vehicles={vehicles}
        realKilometersByPlate={{}}
        plannedKilometers=""
        onRealKilometersChange={vi.fn()}
        onPlannedKilometersChange={onPlannedKilometersChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("KP del período"), { target: { value: "200" } });

    expect(onPlannedKilometersChange).toHaveBeenCalledWith("200");
  });

  it("keeps displaying prior KR values after the vehicle list is re-sorted, since rendering is purely driven by props", () => {
    const { rerender } = render(
      <VehicleMeasurementTable
        vehicles={vehicles}
        realKilometersByPlate={{ AAA111: "80", BB222CC: "42" }}
        plannedKilometers=""
        onRealKilometersChange={vi.fn()}
        onPlannedKilometersChange={vi.fn()}
      />,
    );

    const reSorted = [...vehicles].reverse();
    rerender(
      <VehicleMeasurementTable
        vehicles={reSorted}
        realKilometersByPlate={{ AAA111: "80", BB222CC: "42" }}
        plannedKilometers=""
        onRealKilometersChange={vi.fn()}
        onPlannedKilometersChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("KR de aaa-111")).toHaveValue(80);
    expect(screen.getByLabelText("KR de BB222CC")).toHaveValue(42);
  });
});
