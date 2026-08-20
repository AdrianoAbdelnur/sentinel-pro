import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { readWorkbookGrid } from "./read-workbook-grid";

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

describe("readWorkbookGrid", () => {
  it("parses the committed .xlsx fixture into the expected grid shape", async () => {
    const bytes = readFileSync(path.join(__dirname, "fixtures", "sample-trip-workbook.xlsx"));

    const result = await readWorkbookGrid(toArrayBuffer(bytes));

    expect(result.kind).toBe("read");
    if (result.kind !== "read") return;
    expect(result.grid[0]).toEqual(["Fecha", "Viaje", "DOMÍNIO", "Empresa"]);
    expect(result.grid).toHaveLength(6);
    expect(result.grid[1]).toEqual(["2024-05-01", "T1", "ab-123-cd", "Acme"]);
  });

  it("reports an unreadable-file outcome for non-workbook bytes", async () => {
    const bytes = new TextEncoder().encode("this is not a spreadsheet").buffer;

    const result = await readWorkbookGrid(bytes as ArrayBuffer);

    expect(result).toEqual({ kind: "unreadable-file" });
  });
});
