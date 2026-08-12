import { describe, expect, it } from "vitest";

import type { CatalogImportCandidate } from "./ports";
import { authorizeCatalogSnapshot } from "./authorize-catalog-snapshot";

const mixedSnapshot: CatalogImportCandidate[] = [
  { externalId: "device-x", companyId: "company-a", externalFleetId: "fleet-x" },
  { externalId: "device-y", companyId: "company-b", externalFleetId: "fleet-y" },
  { externalId: "device-z", companyId: "company-a", externalFleetId: "fleet-z" },
];

describe("authorizeCatalogSnapshot", () => {
  it("isolates two Companies that share one Howen master credential and rejects an unknown fleet before catalog import", () => {
    const companyA = authorizeCatalogSnapshot(
      { id: "connection-a", organizationId: "org", credentialRef: "vault:howen/master", companyId: "company-a", authorizedExternalFleetIds: ["fleet-x"] },
      mixedSnapshot,
    );
    const companyB = authorizeCatalogSnapshot(
      { id: "connection-b", organizationId: "org", credentialRef: "vault:howen/master", companyId: "company-b", authorizedExternalFleetIds: ["fleet-y"] },
      mixedSnapshot,
    );

    expect(companyA).toEqual([{ externalId: "device-x", companyId: "company-a", externalFleetId: "fleet-x" }]);
    expect(companyB).toEqual([{ externalId: "device-y", companyId: "company-b", externalFleetId: "fleet-y" }]);
    expect(companyA).not.toContainEqual(expect.objectContaining({ externalId: "device-y" }));
  });

  it("uses Cybermapa's stable external company label when the observed contract has no fleet identifier", () => {
    const connection = { id: "connection-a", organizationId: "org", credentialRef: "vault:cybermapa/master", companyId: "company-a", authorizedExternalCompanyLabels: ["empresa a"] };
    const candidates: CatalogImportCandidate[] = [
      { externalId: "gps-10", companyLabel: " Empresa A " },
      { externalId: "gps-11", companyLabel: "Empresa B" },
    ];

    expect(authorizeCatalogSnapshot(connection, candidates)).toEqual([{ externalId: "gps-10", companyId: "company-a", companyLabel: " Empresa A " }]);
  });

  it("denies missing allowlists and remains deterministic when a snapshot repeats", () => {
    const connection = { id: "connection-a", organizationId: "org", credentialRef: "vault:howen/master", companyId: "company-a" };
    expect(authorizeCatalogSnapshot(connection, mixedSnapshot)).toEqual([]);

    const authorized = { ...connection, authorizedExternalFleetIds: ["fleet-x"] };
    expect(authorizeCatalogSnapshot(authorized, mixedSnapshot)).toEqual(authorizeCatalogSnapshot(authorized, mixedSnapshot));
  });
});
