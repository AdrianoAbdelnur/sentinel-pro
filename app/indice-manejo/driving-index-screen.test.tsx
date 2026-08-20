import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { DrivingIndexWorkbookParser, WorkbookParseResult } from "@/application/driving-index/contracts";

import { DrivingIndexScreen } from "./driving-index-screen";

function stubParser(result: WorkbookParseResult): DrivingIndexWorkbookParser {
  return { parse: vi.fn().mockResolvedValue(result) };
}

describe("DrivingIndexScreen", () => {
  it("updates the period without touching workbook state", () => {
    render(<DrivingIndexScreen parser={stubParser({ kind: "failed", code: "unreadable-file" })} />);

    fireEvent.change(screen.getByLabelText("Mes"), { target: { value: "5" } });

    expect(screen.getByLabelText("Mes")).toHaveValue("5");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("populates the vehicle table after a successful parse", async () => {
    const parser = stubParser({
      kind: "parsed",
      rows: [{ plate: "AB123CD" }, { plate: "XYZ789" }],
    });
    render(<DrivingIndexScreen parser={parser} />);

    const file = new File(["contenido"], "viajes.xlsx");
    fireEvent.change(screen.getByLabelText("Planilla de viajes"), { target: { files: [file] } });

    expect(await screen.findByText("AB123CD")).toBeInTheDocument();
    expect(screen.getByText("XYZ789")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("renders the matching notice and no table when the parse fails", async () => {
    const parser = stubParser({ kind: "failed", code: "missing-plate-column" });
    render(<DrivingIndexScreen parser={parser} />);

    const file = new File(["contenido"], "viajes.xlsx");
    fireEvent.change(screen.getByLabelText("Planilla de viajes"), { target: { files: [file] } });

    expect(await screen.findByRole("status")).toHaveTextContent(/columna.*dominio/i);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("renders a no-usable-rows notice when the parse succeeds but every row is excluded", async () => {
    const parser = stubParser({ kind: "parsed", rows: [{ plate: "" }] });
    render(<DrivingIndexScreen parser={parser} />);

    const file = new File(["contenido"], "viajes.xlsx");
    fireEvent.change(screen.getByLabelText("Planilla de viajes"), { target: { files: [file] } });

    expect(await screen.findByRole("status")).toHaveTextContent(/no se encontraron vehículos/i);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("keeps entered KR and KP values across a forced re-render", async () => {
    const parser = stubParser({ kind: "parsed", rows: [{ plate: "AB123CD" }] });
    const { rerender } = render(<DrivingIndexScreen parser={parser} />);

    const file = new File(["contenido"], "viajes.xlsx");
    fireEvent.change(screen.getByLabelText("Planilla de viajes"), { target: { files: [file] } });
    await screen.findByText("AB123CD");

    fireEvent.change(screen.getByLabelText("KR de AB123CD"), { target: { value: "77" } });
    fireEvent.change(screen.getByLabelText("KP del período"), { target: { value: "300" } });

    rerender(<DrivingIndexScreen parser={parser} />);

    expect(screen.getByLabelText("KR de AB123CD")).toHaveValue(77);
    expect(screen.getByLabelText("KP del período")).toHaveValue(300);
  });

  it("clears prior KR/KP and replaces the vehicle list when a second workbook is uploaded", async () => {
    const firstParser = stubParser({ kind: "parsed", rows: [{ plate: "AB123CD" }] });
    render(<DrivingIndexScreen parser={firstParser} />);

    fireEvent.change(screen.getByLabelText("Planilla de viajes"), {
      target: { files: [new File(["a"], "viajes-1.xlsx")] },
    });
    await screen.findByText("AB123CD");
    fireEvent.change(screen.getByLabelText("KR de AB123CD"), { target: { value: "77" } });
    fireEvent.change(screen.getByLabelText("KP del período"), { target: { value: "300" } });

    (firstParser.parse as ReturnType<typeof vi.fn>).mockResolvedValue({
      kind: "parsed",
      rows: [{ plate: "ZZZ999" }],
    });

    fireEvent.change(screen.getByLabelText("Planilla de viajes"), {
      target: { files: [new File(["b"], "viajes-2.xlsx")] },
    });
    await screen.findByText("ZZZ999");

    expect(screen.queryByText("AB123CD")).not.toBeInTheDocument();
    expect(screen.getByLabelText("KR de ZZZ999")).toHaveValue(null);
    expect(screen.getByLabelText("KP del período")).toHaveValue(null);
  });
});
