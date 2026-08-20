import { describe, expect, it } from "vitest";

import type { WorkbookRow } from "./contracts";
import { buildDrivingIndexReportDraft } from "./build-driving-index-report-draft";

const period = { month: 5, year: 2024 };

describe("buildDrivingIndexReportDraft", () => {
  it("dedupes rows that share a canonical plate across rows, trips, and companies into one vehicle entry", () => {
    const rows: WorkbookRow[] = [
      { date: "2024-05-01", trip: "T1", plate: "ab-123-cd", company: "Acme" },
      { trip: "T1", plate: "AB123CD", company: "Acme" },
      { trip: "T2", plate: " AB123CD ", company: "Beta" },
    ];

    const result = buildDrivingIndexReportDraft(rows, period);

    expect(result).toEqual({
      kind: "built",
      draft: {
        period,
        vehicles: [
          { canonicalPlate: "AB123CD", displayPlate: "ab-123-cd", plateFormat: "mercosur" },
        ],
      },
    });
  });

  it("sorts vehicles alphabetically by canonical plate regardless of workbook row order", () => {
    const rows: WorkbookRow[] = [
      { plate: "ZZZ999" },
      { plate: "AAA111" },
      { plate: "MMM555" },
    ];

    const result = buildDrivingIndexReportDraft(rows, period);

    expect(result.kind).toBe("built");
    expect(result.kind === "built" ? result.draft.vehicles.map((vehicle) => vehicle.canonicalPlate) : []).toEqual([
      "AAA111",
      "MMM555",
      "ZZZ999",
    ]);
  });

  it("retains the original display plate and classified plate format per vehicle", () => {
    const rows: WorkbookRow[] = [{ plate: "xy456zt" }];

    const result = buildDrivingIndexReportDraft(rows, period);

    expect(result).toEqual({
      kind: "built",
      draft: {
        period,
        vehicles: [
          { canonicalPlate: "XY456ZT", displayPlate: "xy456zt", plateFormat: "mercosur" },
        ],
      },
    });
  });

  it("reports a no-usable-rows failure when the input is empty", () => {
    const result = buildDrivingIndexReportDraft([], period);

    expect(result).toEqual({ kind: "failed", code: "no-usable-rows" });
  });

  it("reports a no-usable-rows failure when every row normalizes to a blank plate", () => {
    const rows: WorkbookRow[] = [{ plate: "" }, { plate: "   " }];

    const result = buildDrivingIndexReportDraft(rows, period);

    expect(result).toEqual({ kind: "failed", code: "no-usable-rows" });
  });
});
