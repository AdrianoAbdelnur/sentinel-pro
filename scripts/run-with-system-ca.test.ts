import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execute = promisify(execFile);

describe("run-with-system-ca", () => {
  it("passes the system CA option to the process it launches", async () => {
    const { stdout } = await execute(process.execPath, ["scripts/run-with-system-ca.mjs", process.execPath, "-e", "process.stdout.write(process.env.NODE_OPTIONS ?? '')"]);

    expect(stdout).toContain("--use-system-ca");
  }, 10_000);
});
