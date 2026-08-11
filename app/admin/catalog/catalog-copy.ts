import type { CatalogSyncCounts, CatalogSyncRunStatus, CatalogSyncTrigger } from "@/domain/catalog";

export const RUN_STATUS_LABELS: Record<CatalogSyncRunStatus, string> = { active: "En curso", succeeded: "Exitosa", failed: "Fallida" };

export const RUN_TRIGGER_LABELS: Record<CatalogSyncTrigger, string> = { initial: "Inicial", scheduled: "Programada", manual: "Manual" };

export const COUNT_LABELS: Record<keyof CatalogSyncCounts, string> = { processed: "Procesados", created: "Creados", linked: "Vinculados", reviewed: "En revisión", rejected: "Rechazados", absent: "Ausentes" };
