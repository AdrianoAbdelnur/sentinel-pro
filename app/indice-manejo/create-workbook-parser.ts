import type {
  DrivingIndexWorkbookParser,
  WorkbookParseResult,
} from "@/application/driving-index/contracts";
import { readWorkbookGrid } from "@/integrations/driving-index/read-workbook-grid";
import { parseSpreadsheetWorkbookGrid } from "@/integrations/driving-index/spreadsheet-workbook-parser";

export function createWorkbookParser(): DrivingIndexWorkbookParser {
  return {
    async parse(bytes: ArrayBuffer): Promise<WorkbookParseResult> {
      const gridResult = await readWorkbookGrid(bytes);
      if (gridResult.kind === "unreadable-file") {
        return { kind: "failed", code: "unreadable-file" };
      }

      return parseSpreadsheetWorkbookGrid(gridResult.grid);
    },
  };
}
