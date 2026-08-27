export type CatalogConflictKind = "company" | "identity";

export type CatalogConflict = Readonly<{
  id: string;
  vehicleId: string;
  kind: CatalogConflictKind;
  values: readonly string[];
  status: "open" | "resolved";
  canonicalValue?: string;
}>;

export function createCatalogConflict(input: CatalogConflict): CatalogConflict {
  return Object.freeze({ ...input, values: Object.freeze([...input.values]) });
}
