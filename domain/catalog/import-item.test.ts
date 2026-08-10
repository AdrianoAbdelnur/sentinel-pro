import { describe, expect, it } from "vitest";

import { markCatalogImportItemProcessed, stageCatalogImportItem } from "./import-item";

describe("catalog import item checkpoint", () => {
  it("stages a pending import item scoped to its connection and run, with no outcome recorded yet", () => {
    const item = stageCatalogImportItem("item-1", { organizationId: "org-a", connectionId: "conn-cyber", runId: "run-1", externalId: "gps-9001" });

    expect(item).toEqual({ id: "item-1", organizationId: "org-a", connectionId: "conn-cyber", runId: "run-1", externalId: "gps-9001", status: "pending" });
  });

  it("marks a staged import item processed with its committed outcome, without losing its identifying scope", () => {
    const staged = stageCatalogImportItem("item-1", { organizationId: "org-a", connectionId: "conn-cyber", runId: "run-1", externalId: "gps-9001" });

    const processed = markCatalogImportItemProcessed(staged, "created");

    expect(processed).toEqual({ ...staged, status: "processed", outcome: "created" });
  });
});
