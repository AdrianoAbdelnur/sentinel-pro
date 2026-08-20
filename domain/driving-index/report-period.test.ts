import { describe, expect, it } from "vitest";

import { createReportPeriod } from "./report-period";

describe("createReportPeriod", () => {
  it("builds a valid report period from an explicit month and year", () => {
    expect(createReportPeriod(5, 2024)).toEqual({
      kind: "valid",
      period: { month: 5, year: 2024 },
    });
  });

  it("builds a different valid report period for different explicit inputs", () => {
    expect(createReportPeriod(12, 2025)).toEqual({
      kind: "valid",
      period: { month: 12, year: 2025 },
    });
  });

  it("rejects a month below the valid range", () => {
    expect(createReportPeriod(0, 2024)).toEqual({
      kind: "invalid",
      reason: "invalid-month",
    });
  });

  it("rejects a month above the valid range", () => {
    expect(createReportPeriod(13, 2024)).toEqual({
      kind: "invalid",
      reason: "invalid-month",
    });
  });

  it("rejects a non-integer month", () => {
    expect(createReportPeriod(5.5, 2024)).toEqual({
      kind: "invalid",
      reason: "invalid-month",
    });
  });

  it("rejects a year outside the supported range", () => {
    expect(createReportPeriod(5, 1899)).toEqual({
      kind: "invalid",
      reason: "invalid-year",
    });
  });

  it("requires both month and year explicitly — the function has no default parameters, so the current date can never be substituted silently", () => {
    expect(createReportPeriod.length).toBe(2);
  });
});
