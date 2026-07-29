import { formatLastReportTime, formatLastReportTitle } from "./format-last-report";

// `Intl`'s implicit locale and time zone differ between the Node server render
// and the browser, so this formatter pins both rather than reading the runtime
// default. These tests are what hold that pinning in place.
describe("formatLastReportTime", () => {
  it("formats a UTC instant in the Buenos Aires time zone as HH:mm", () => {
    expect(formatLastReportTime("2026-07-29T12:03:00.000Z")).toBe("09:03");
  });

  it("pads a midnight-crossing instant with a leading zero, not 24:mm", () => {
    // 03:05 UTC minus the fixed -03:00 offset is 00:05 local time.
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
