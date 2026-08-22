import type { CatalogSyncCounts, CatalogSyncRun } from "@/application/catalog/synchronize-connection";

export const RUN_STATUS_LABELS: Record<CatalogSyncRun["status"], string> = { active: "En curso", succeeded: "Exitosa", failed: "Fallida" };

export const RUN_TRIGGER_LABELS: Record<CatalogSyncRun["trigger"], string> = { initial: "Inicial", manual: "Manual", internal: "Interna", scheduler: "Programada" };

export const COUNT_LABELS: Record<keyof CatalogSyncCounts, string> = { processed: "Procesados", created: "Creados", linked: "Vinculados", reviewed: "En revisión", rejected: "Rechazados", absent: "Ausentes" };
