import { describe, expect, it } from "vitest";

import type { WorkbookGrid } from "./spreadsheet-workbook-parser";
import { parseSpreadsheetWorkbookGrid } from "./spreadsheet-workbook-parser";

describe("parseSpreadsheetWorkbookGrid", () => {
  it("resolves the plate column case- and accent-insensitively (e.g. DOMÍNIO) and extracts rows", () => {
    const grid: WorkbookGrid = [
      ["Fecha", "Viaje", "DOMÍNIO", "Empresa"],
      ["2024-05-01", "T1", "AB123CD", "Acme"],
    ];

    const result = parseSpreadsheetWorkbookGrid(grid);

    expect(result).toEqual({
      kind: "parsed",
      rows: [{ date: "2024-05-01", trip: "T1", plate: "AB123CD", company: "Acme" }],
    });
  });

  it("resolves the plate column when the header is spelled lowercase 'dominio'", () => {
    const grid: WorkbookGrid = [
      ["Fecha", "Viaje", "dominio", "Empresa"],
      ["2024-05-01", "T1", "AB123CD", "Acme"],
    ];

    const result = parseSpreadsheetWorkbookGrid(grid);

    expect(result.kind).toBe("parsed");
  });

  it("forward-fills Fecha and Viaje on continuation rows that are blank", () => {
    const grid: WorkbookGrid = [
      ["Fecha", "Viaje", "Dominio", "Empresa"],
      ["2024-05-01", "T1", "AB123CD", "Acme"],
      [null, null, "XY456ZT", "Acme"],
      [null, null, "ZZZ999", "Acme"],
    ];

    const result = parseSpreadsheetWorkbookGrid(grid);

    expect(result).toEqual({
      kind: "parsed",
      rows: [
        { date: "2024-05-01", trip: "T1", plate: "AB123CD", company: "Acme" },
        { date: "2024-05-01", trip: "T1", plate: "XY456ZT", company: "Acme" },
        { date: "2024-05-01", trip: "T1", plate: "ZZZ999", company: "Acme" },
      ],
    });
  });

  it("excludes a row with a blank Dominio after forward-fill without aborting the rest", () => {
    const grid: WorkbookGrid = [
      ["Fecha", "Viaje", "Dominio", "Empresa"],
      ["2024-05-01", "T1", "AB123CD", "Acme"],
      ["2024-05-02", "T2", null, "Acme"],
      ["2024-05-03", "T3", "XY456ZT", "Acme"],
    ];

    const result = parseSpreadsheetWorkbookGrid(grid);

    expect(result).toEqual({
      kind: "parsed",
      rows: [
        { date: "2024-05-01", trip: "T1", plate: "AB123CD", company: "Acme" },
        { date: "2024-05-03", trip: "T3", plate: "XY456ZT", company: "Acme" },
      ],
    });
  });

  it("reports a missing-plate-column failure when no header resolves to Dominio", () => {
    const grid: WorkbookGrid = [
      ["Fecha", "Viaje", "Empresa"],
      ["2024-05-01", "T1", "Acme"],
    ];

    const result = parseSpreadsheetWorkbookGrid(grid);

    expect(result).toEqual({ kind: "failed", code: "missing-plate-column" });
  });

  it("parses to an empty row list (not a failure) when headers are valid but there are no data rows", () => {
    const grid: WorkbookGrid = [["Fecha", "Viaje", "Dominio", "Empresa"]];

    const result = parseSpreadsheetWorkbookGrid(grid);

    expect(result).toEqual({ kind: "parsed", rows: [] });
  });
});
