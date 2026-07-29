import { formatLastReportTime, formatLastReportTitle } from "./format-last-report";

describe("formatLastReportTime", () => {
  it("formats a UTC instant in the Buenos Aires time zone as HH:mm", () => {
    expect(formatLastReportTime("2026-07-29T12:03:00.000Z")).toBe("09:03");
  });

  it("pads a midnight-crossing instant with a leading zero, not 24:mm", () => {
    expect(formatLastReportTime("2026-07-29T03:05:00.000Z")).toBe("00:05");
  });
});

describe("formatLastReportTitle", () => {
  it("includes the full local date and time", () => {
    const title = formatLastReportTitle("2026-07-29T12:03:00.000Z");

    expect(title).toContain("2026");
    expect(title).toMatch(/9:03/);
  });
});
