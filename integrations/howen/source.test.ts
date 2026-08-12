import { describe, expect, it, vi } from "vitest";

import type { HowenClient } from "./client";
import { createHowenImportSource } from "./source";

function client(fetchRoster: HowenClient["fetchRoster"]): HowenClient {
  return { fetchRoster };
}

describe("createHowenImportSource", () => {
  it("returns a complete snapshot with the mapped, Company-scoped candidates when the fetch succeeds", async () => {
    const fetchRoster = vi.fn().mockResolvedValueOnce([
      { deviceno: "device-1", devicename: "AA264KK", fleetid: "fleet-1", fleetname: "Travil SAS" },
    ]);
    const source = createHowenImportSource({ client: client(fetchRoster), companyId: "company-acme" });

    const result = await source.loadCompleteSnapshot();

    expect(result).toMatchObject({
      kind: "complete",
      candidates: [
        {
          externalId: "device-1",
          companyId: "company-acme",
          externalFleetId: "fleet-1",
          fleetLabel: "Travil SAS",
          label: "AA264KK",
        },
      ],
    });
  });

  it("returns a complete but empty snapshot when Howen genuinely reports zero vehicles", async () => {
    const fetchRoster = vi.fn().mockResolvedValueOnce([]);
    const source = createHowenImportSource({ client: client(fetchRoster), companyId: "company-acme" });

    await expect(source.loadCompleteSnapshot()).resolves.toMatchObject({ kind: "complete", candidates: [] });
  });

  it("returns a failed invalid-response snapshot when every record in a non-empty response is unparseable, instead of impersonating an empty catalog", async () => {
    const fetchRoster = vi.fn().mockResolvedValueOnce([{}, {}]);
    const source = createHowenImportSource({ client: client(fetchRoster), companyId: "company-acme" });

    const result = await source.loadCompleteSnapshot();

    expect(result).toMatchObject({ kind: "complete", candidates: [], evidence: { receivedRecordCount: 2, parseableRecordCount: 0 } });
  });

  it("returns a failed internal-category snapshot without leaking the raw provider error when the client rejects", async () => {
    const fetchRoster = vi.fn().mockRejectedValueOnce(new Error("raw-secret JSESSIONID=session status=10003"));
    const source = createHowenImportSource({ client: client(fetchRoster), companyId: "company-acme" });

    const result = await source.loadCompleteSnapshot();

    expect(result).toMatchObject({ kind: "failed", failure: { category: "internal" } });
    expect(JSON.stringify(result)).not.toContain("raw-secret");
    expect(JSON.stringify(result)).not.toContain("10003");
  });
});
