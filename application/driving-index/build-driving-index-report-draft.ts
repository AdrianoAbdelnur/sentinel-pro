import { classifyPlateFormat, normalizePlate } from "@/domain/catalog";

import type {
  DrivingIndexReportDraftResult,
  DrivingIndexVehicleRow,
  ReportPeriod,
  WorkbookRow,
} from "./contracts";

export function buildDrivingIndexReportDraft(
  rows: WorkbookRow[],
  period: ReportPeriod,
): DrivingIndexReportDraftResult {
  const vehiclesByCanonicalPlate = new Map<string, DrivingIndexVehicleRow>();

  for (const row of rows) {
    const canonicalPlate = normalizePlate(row.plate);
    if (canonicalPlate === "") continue;
    if (vehiclesByCanonicalPlate.has(canonicalPlate)) continue;

    vehiclesByCanonicalPlate.set(canonicalPlate, {
      canonicalPlate,
      displayPlate: row.plate,
      plateFormat: classifyPlateFormat(canonicalPlate),
    });
  }

  if (vehiclesByCanonicalPlate.size === 0) {
    return { kind: "failed", code: "no-usable-rows" };
  }

  const vehicles = [...vehiclesByCanonicalPlate.values()].sort((a, b) =>
    a.canonicalPlate.localeCompare(b.canonicalPlate),
  );

  return { kind: "built", draft: { period, vehicles } };
}
