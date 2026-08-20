import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { createWorkbookParser } from "./create-workbook-parser";

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

describe("createWorkbookParser composition", () => {
  it("parses the fixture workbook end to end into rows", async () => {
    const bytes = readFileSync(
      path.join(process.cwd(), "integrations", "driving-index", "fixtures", "sample-trip-workbook.xlsx"),
    );

    const result = await createWorkbookParser().parse(toArrayBuffer(bytes));

    expect(result.kind).toBe("parsed");
    if (result.kind !== "parsed") return;
    expect(result.rows.length).toBeGreaterThan(0);
  });

  it("propagates an unreadable-file failure without reaching the format parser", async () => {
    const bytes = new TextEncoder().encode("not a workbook").buffer;

    const result = await createWorkbookParser().parse(bytes as ArrayBuffer);

    expect(result).toEqual({ kind: "failed", code: "unreadable-file" });
  });
});
