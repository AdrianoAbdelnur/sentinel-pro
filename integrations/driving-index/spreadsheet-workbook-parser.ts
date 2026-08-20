import type { WorkbookParseResult, WorkbookRow } from "@/application/driving-index/contracts";

export type WorkbookGridCell = string | number | null;
export type WorkbookGrid = WorkbookGridCell[][];

type WorkbookField = "date" | "trip" | "plate" | "company";

const HEADER_FIELD_BY_NORMALIZED_NAME: Record<string, WorkbookField> = {
  fecha: "date",
  viaje: "trip",
  dominio: "plate",
  empresa: "company",
};

function normalizeHeaderText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

function cellToText(cell: WorkbookGridCell | undefined): string | undefined {
  if (cell === null || cell === undefined) return undefined;
  const text = String(cell).trim();
  return text === "" ? undefined : text;
}

function resolveFieldColumns(headerRow: WorkbookGrid[number]): Map<number, WorkbookField> {
  const fieldByColumnIndex = new Map<number, WorkbookField>();

  headerRow.forEach((headerCell, columnIndex) => {
    const headerText = cellToText(headerCell);
    if (headerText === undefined) return;
    const field = HEADER_FIELD_BY_NORMALIZED_NAME[normalizeHeaderText(headerText)];
    if (field !== undefined) fieldByColumnIndex.set(columnIndex, field);
  });

  return fieldByColumnIndex;
}

export function parseSpreadsheetWorkbookGrid(grid: WorkbookGrid): WorkbookParseResult {
  const [headerRow, ...dataRows] = grid;
  if (headerRow === undefined) {
    return { kind: "failed", code: "missing-plate-column" };
  }

  const fieldByColumnIndex = resolveFieldColumns(headerRow);
  const hasPlateColumn = [...fieldByColumnIndex.values()].includes("plate");
  if (!hasPlateColumn) {
    return { kind: "failed", code: "missing-plate-column" };
  }

  let lastDate: string | undefined;
  let lastTrip: string | undefined;
  const rows: WorkbookRow[] = [];

  for (const dataRow of dataRows) {
    const values: Partial<Record<WorkbookField, string>> = {};
    for (const [columnIndex, field] of fieldByColumnIndex) {
      const text = cellToText(dataRow[columnIndex]);
      if (text !== undefined) values[field] = text;
    }

    if (values.date !== undefined) lastDate = values.date;
    if (values.trip !== undefined) lastTrip = values.trip;

    if (values.plate === undefined) continue;

    rows.push({
      date: values.date ?? lastDate,
      trip: values.trip ?? lastTrip,
      plate: values.plate,
      company: values.company,
    });
  }

  return { kind: "parsed", rows };
}
