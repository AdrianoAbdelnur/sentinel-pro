export type ReportPeriod = {
  month: number;
  year: number;
};

export type ReportPeriodValidationFailure = "invalid-month" | "invalid-year";

export type ReportPeriodResult =
  | { kind: "valid"; period: ReportPeriod }
  | { kind: "invalid"; reason: ReportPeriodValidationFailure };

const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

export function createReportPeriod(month: number, year: number): ReportPeriodResult {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return { kind: "invalid", reason: "invalid-month" };
  }

  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
    return { kind: "invalid", reason: "invalid-year" };
  }

  return { kind: "valid", period: { month, year } };
}
