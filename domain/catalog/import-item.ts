export type CatalogImportItemStatus = "pending" | "processed";
export type CatalogImportItemOutcome = "created" | "linked" | "reviewed" | "rejected";

export type CatalogImportItem = {
  id: string;
  organizationId: string;
  connectionId: string;
  runId: string;
  externalId: string;
  status: CatalogImportItemStatus;
  outcome?: CatalogImportItemOutcome;
};

export function stageCatalogImportItem(
  id: string,
  params: { organizationId: string; connectionId: string; runId: string; externalId: string },
): CatalogImportItem {
  return { id, ...params, status: "pending" };
}

export function markCatalogImportItemProcessed(
  item: CatalogImportItem,
  outcome: CatalogImportItemOutcome,
): CatalogImportItem {
  return { ...item, status: "processed", outcome };
}
