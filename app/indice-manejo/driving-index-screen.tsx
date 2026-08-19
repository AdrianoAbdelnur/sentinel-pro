"use client";

import { useState } from "react";

import type {
  DrivingIndexVehicleRow,
  DrivingIndexWorkbookParser,
  WorkbookParseFailureCode,
} from "@/application/driving-index/contracts";
import { buildDrivingIndexReportDraft } from "@/application/driving-index/build-driving-index-report-draft";
import { ReportPeriodPicker } from "@/components/driving-index/report-period-picker";
import { VehicleMeasurementTable } from "@/components/driving-index/vehicle-measurement-table";
import { WorkbookNotice } from "@/components/driving-index/workbook-notice";
import { WorkbookUploadField } from "@/components/driving-index/workbook-upload-field";

import { createWorkbookParser } from "./create-workbook-parser";

type PeriodState = { month: number | null; year: number | null };

type WorkbookState =
  | { kind: "idle" }
  | { kind: "parsing" }
  | { kind: "ready"; vehicles: DrivingIndexVehicleRow[] }
  | { kind: "failed"; code: WorkbookParseFailureCode };

type MeasurementsState = {
  realKilometersByPlate: Record<string, string>;
  plannedKilometers: string;
};

const EMPTY_MEASUREMENTS: MeasurementsState = { realKilometersByPlate: {}, plannedKilometers: "" };

type DrivingIndexScreenProps = {
  parser?: DrivingIndexWorkbookParser;
};

export function DrivingIndexScreen({ parser }: DrivingIndexScreenProps) {
  const [period, setPeriod] = useState<PeriodState>({ month: null, year: null });
  const [workbook, setWorkbook] = useState<WorkbookState>({ kind: "idle" });
  const [measurements, setMeasurements] = useState<MeasurementsState>(EMPTY_MEASUREMENTS);
  const [resolvedParser] = useState<DrivingIndexWorkbookParser>(() => parser ?? createWorkbookParser());

  async function handleFileSelected(bytes: ArrayBuffer) {
    setWorkbook({ kind: "parsing" });
    const parseResult = await resolvedParser.parse(bytes);

    if (parseResult.kind === "failed") {
      setWorkbook({ kind: "failed", code: parseResult.code });
      return;
    }

    const draftResult = buildDrivingIndexReportDraft(parseResult.rows, {
      month: period.month ?? 0,
      year: period.year ?? 0,
    });

    if (draftResult.kind === "failed") {
      setWorkbook({ kind: "failed", code: draftResult.code });
      return;
    }

    setWorkbook({ kind: "ready", vehicles: draftResult.draft.vehicles });
    setMeasurements(EMPTY_MEASUREMENTS);
  }

  function handleRealKilometersChange(canonicalPlate: string, value: string) {
    setMeasurements((current) => ({
      ...current,
      realKilometersByPlate: { ...current.realKilometersByPlate, [canonicalPlate]: value },
    }));
  }

  function handlePlannedKilometersChange(value: string) {
    setMeasurements((current) => ({ ...current, plannedKilometers: value }));
  }

  return (
    <div className="flex flex-col gap-6">
      <ReportPeriodPicker
        month={period.month}
        year={period.year}
        onMonthChange={(month) => setPeriod((current) => ({ ...current, month }))}
        onYearChange={(year) => setPeriod((current) => ({ ...current, year }))}
      />
      <WorkbookUploadField onFileSelected={(bytes) => void handleFileSelected(bytes)} />
      {workbook.kind === "failed" ? <WorkbookNotice code={workbook.code} /> : null}
      {workbook.kind === "ready" ? (
        <VehicleMeasurementTable
          vehicles={workbook.vehicles}
          realKilometersByPlate={measurements.realKilometersByPlate}
          plannedKilometers={measurements.plannedKilometers}
          onRealKilometersChange={handleRealKilometersChange}
          onPlannedKilometersChange={handlePlannedKilometersChange}
        />
      ) : null}
    </div>
  );
}
