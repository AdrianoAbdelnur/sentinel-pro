import { createCatalogConflict, normalizeGroupLabel, type CatalogConflict, type CatalogDevice, type CatalogVehicle, type ProviderVehicleObservation } from "@/domain/catalog";

export type CanonicalVehicleReconciliation = { vehicle: CatalogVehicle; conflict?: CatalogConflict };

export function reconcileCanonicalVehicle(vehicle: CatalogVehicle, observations: readonly ProviderVehicleObservation[], sourcePrecedence: readonly string[] = ["cybermapa", "howen"], devices?: readonly CatalogDevice[]): CanonicalVehicleReconciliation {
  const current = observations.filter((observation) => observation.presence !== "absent");
  const companies = current.filter((observation) => observation.company?.trim());
  const order = (observation: ProviderVehicleObservation) => { const index = sourcePrecedence.indexOf(observation.providerKey ?? observation.connectionId); return index < 0 ? Number.MAX_SAFE_INTEGER : index; };
  const ordered = [...companies].sort((left, right) => order(left) - order(right));
  const first = ordered[0];
  const canonicalCompany = first?.company?.trim();
  const valuesByNormalizedCompany = new Map<string, string>();
  for (const company of companies) {
    const value = company.company!.trim();
    const normalized = normalizeGroupLabel(value);
    if (!valuesByNormalizedCompany.has(normalized)) valuesByNormalizedCompany.set(normalized, value);
  }
  const values = [...valuesByNormalizedCompany.values()];
  const descriptive = [...current].sort((left, right) => order(left) - order(right));
  const select = (field: "name" | "make" | "model" | "plate" | "normalizedPlate") => descriptive.find((observation) => observation[field]?.trim())?.[field]?.trim();
  const active = devices?.some((device) => device.presence === "present" && device.status === "active") ?? false;
  const name = select("name");
  const make = select("make");
  const model = select("model");
  const plate = select("plate");
  const normalizedPlate = select("normalizedPlate");
  const nextVehicle = {
    ...vehicle,
    active,
    ...(canonicalCompany ? { company: canonicalCompany } : { company: undefined }),
    ...(name ? { name } : { name: undefined }),
    ...(make ? { make } : { make: undefined }),
    ...(model ? { model } : { model: undefined }),
    plate: plate ?? "",
    normalizedPlate: normalizedPlate ?? "",
  };
  if (values.length < 2) return { vehicle: nextVehicle };
  return { vehicle: nextVehicle, conflict: createCatalogConflict({ id: `company:${vehicle.id}`, vehicleId: vehicle.id, kind: "company", values, canonicalValue: canonicalCompany, status: "open" }) };
}
