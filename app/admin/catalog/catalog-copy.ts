import type { GlobalSyncCounts, GlobalSyncRun } from "@/application/catalog-global/synchronize-global-connection";

export const RUN_STATUS_LABELS: Record<GlobalSyncRun["status"], string> = { active: "En curso", succeeded: "Exitosa", failed: "Fallida" };

export const RUN_TRIGGER_LABELS: Record<GlobalSyncRun["trigger"], string> = { initial: "Inicial", manual: "Manual", internal: "Interna", scheduler: "Programada" };

export const COUNT_LABELS: Record<keyof GlobalSyncCounts, string> = { processed: "Procesados", created: "Creados", linked: "Vinculados", reviewed: "En revisión", rejected: "Rechazados", absent: "Ausentes" };
