import type { CatalogImportCandidate } from "@/application/catalog";

import type { HowenRosterRecord } from "./responses";

function text(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function mapHowenCatalog(records: HowenRosterRecord[], companyId: string): CatalogImportCandidate[] {
  const seenDeviceNumbers = new Set<string>();
  const candidates: CatalogImportCandidate[] = [];

  for (const record of records) {
    const externalId = text(record.deviceno);
    const label = text(record.devicename);
    const externalFleetId = text(record.fleetid);
    const fleetLabel = text(record.fleetname);

    if (!externalId || !label || !externalFleetId || !fleetLabel || seenDeviceNumbers.has(externalId)) {
      continue;
    }

    seenDeviceNumbers.add(externalId);

    candidates.push({ externalId, companyId, externalFleetId, fleetLabel, label });
  }

  return candidates;
}
