import type { WorkbookGrid, WorkbookGridCell } from "./spreadsheet-workbook-parser";

export type ReadWorkbookGridResult =
  | { kind: "read"; grid: WorkbookGrid }
  | { kind: "unreadable-file" };

function toGridCell(value: unknown): WorkbookGridCell {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number") return value;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export async function readWorkbookGrid(bytes: ArrayBuffer): Promise<ReadWorkbookGridResult> {
  try {
    const { readSheet } = await import("read-excel-file/browser");
    const rows = await readSheet(bytes);
    const grid: WorkbookGrid = rows.map((row) => row.map(toGridCell));
    return { kind: "read", grid };
  } catch {
    return { kind: "unreadable-file" };
  }
}
