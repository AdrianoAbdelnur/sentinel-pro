import type { PlateFormat } from "@/domain/catalog";
import type { ReportPeriod } from "@/domain/driving-index/report-period";

export type { PlateFormat, ReportPeriod };

export type WorkbookRow = {
  date?: string;
  trip?: string;
  plate: string;
  company?: string;
};

export type WorkbookParseFailureCode =
  | "unreadable-file"
  | "missing-plate-column"
  | "no-usable-rows";

export type WorkbookParseResult =
  | { kind: "parsed"; rows: WorkbookRow[] }
  | { kind: "failed"; code: WorkbookParseFailureCode };

export type DrivingIndexWorkbookParser = {
  parse(bytes: ArrayBuffer): Promise<WorkbookParseResult>;
};

export type DrivingIndexVehicleRow = {
  canonicalPlate: string;
  displayPlate: string;
  plateFormat: PlateFormat;
};

export type DrivingIndexReportDraft = {
  period: ReportPeriod;
  vehicles: DrivingIndexVehicleRow[];
};

export type DrivingIndexReportDraftFailureCode = "no-usable-rows";

export type DrivingIndexReportDraftResult =
  | { kind: "built"; draft: DrivingIndexReportDraft }
  | { kind: "failed"; code: DrivingIndexReportDraftFailureCode };
