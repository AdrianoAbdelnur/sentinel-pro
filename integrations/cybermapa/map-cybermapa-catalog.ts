import type { CatalogImportCandidate } from "@/application/catalog";
import { normalizeCompanyLabel, normalizePlate } from "@/domain/catalog";

import type { CybermapaVehicleRecord } from "./responses";

function externalId(value: number | string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const normalized = typeof value === "number" ? String(value) : value.trim();
  return normalized === "" ? undefined : normalized;
}

function usableCompanyLabel(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && normalizeCompanyLabel(trimmed).length > 0 ? trimmed : undefined;
}

function usableNormalizedPlate(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const normalized = normalizePlate(value);
  return normalized === "" ? undefined : normalized;
}

function vehicleLabel(record: CybermapaVehicleRecord): string | undefined {
  const alias = record.alias?.trim();
  if (alias) return alias;
  const nombre = record.nombre?.trim();
  return nombre ? nombre : undefined;
}

export function mapCybermapaCatalog(records: CybermapaVehicleRecord[]): CatalogImportCandidate[] {
  const seenExternalIds = new Set<string>();
  const candidates: CatalogImportCandidate[] = [];

  for (const record of records) {
    const id = externalId(record.gps_id);
    const companyLabel = usableCompanyLabel(record.nombre_empresa);

    if (!id || !companyLabel || seenExternalIds.has(id)) {
      continue;
    }

    seenExternalIds.add(id);

    const normalizedPlate = usableNormalizedPlate(record.patente);
    const label = vehicleLabel(record);

    candidates.push({
      externalId: id,
      companyLabel,
      ...(normalizedPlate !== undefined ? { normalizedPlate } : {}),
      ...(label !== undefined ? { label } : {}),
    });
  }

  return candidates;
}
