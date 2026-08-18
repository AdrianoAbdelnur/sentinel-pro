export type PlacementAuthority = "authoritative" | "fallback";
export type GroupEvidenceKind = "company-label" | "fleet-membership";
export type GroupEvidence = Readonly<{ connectionId: string; kind: GroupEvidenceKind; externalKey: string; label: string; authority: "authoritative" | "fallback" }>;
export type CatalogGroup = Readonly<{ id: string; label: string }>;
export type GroupEvidenceBinding = Readonly<{ id: string; groupId: string; evidence: GroupEvidence }>;
export type VehiclePlacement = Readonly<{ groupId: string; authority: PlacementAuthority; evidenceBindingId?: string; assignedAt: Date }>;
export function normalizeGroupLabel(value: string): string {
  return value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().replace(/[^a-z0-9]+/g, "");
}
export function normalizeGroupEvidence(evidence: GroupEvidence): GroupEvidence {
  return { ...evidence, externalKey: evidence.externalKey.trim(), label: evidence.label.trim() };
}
export function createCatalogGroup(input: CatalogGroup): CatalogGroup { return Object.freeze({ ...input }); }
export function createGroupEvidenceBinding(input: GroupEvidenceBinding): GroupEvidenceBinding { return Object.freeze({ ...input, evidence: Object.freeze({ ...input.evidence }) }); }
export function createVehiclePlacement(input: VehiclePlacement): VehiclePlacement { return Object.freeze({ ...input }); }
