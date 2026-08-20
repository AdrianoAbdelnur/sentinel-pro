import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ReportPeriodPicker } from "./report-period-picker";

describe("ReportPeriodPicker", () => {
  it("does not select a month or year by default when no period is provided", () => {
    render(<ReportPeriodPicker month={null} year={null} onMonthChange={vi.fn()} onYearChange={vi.fn()} />);

    expect(screen.getByLabelText("Mes")).toHaveValue("");
    expect(screen.getByLabelText("Año")).toHaveValue(null);
  });

  it("reports the selected month as a number", () => {
    const onMonthChange = vi.fn();
    render(<ReportPeriodPicker month={null} year={null} onMonthChange={onMonthChange} onYearChange={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Mes"), { target: { value: "5" } });

    expect(onMonthChange).toHaveBeenCalledWith(5);
  });

  it("reports the entered year as a number", () => {
    const onYearChange = vi.fn();
    render(<ReportPeriodPicker month={null} year={null} onMonthChange={vi.fn()} onYearChange={onYearChange} />);

    fireEvent.change(screen.getByLabelText("Año"), { target: { value: "2024" } });

    expect(onYearChange).toHaveBeenCalledWith(2024);
  });

  it("reflects an already selected period passed in props", () => {
    render(<ReportPeriodPicker month={3} year={2024} onMonthChange={vi.fn()} onYearChange={vi.fn()} />);

    expect(screen.getByLabelText("Mes")).toHaveValue("3");
    expect(screen.getByLabelText("Año")).toHaveValue(2024);
  });
});
