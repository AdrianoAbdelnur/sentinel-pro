const REPORT_LOCALE = "es-AR";
const REPORT_TIME_ZONE = "America/Argentina/Buenos_Aires";

const dateTimeFormatter = new Intl.DateTimeFormat(REPORT_LOCALE, {
  timeZone: REPORT_TIME_ZONE,
  dateStyle: "medium",
  timeStyle: "medium",
});

export function formatSyncDateTime(value: string | undefined): string {
  return value ? dateTimeFormatter.format(new Date(value)) : "Sin registros";
}

const FAILURE_CATEGORY_TRANSLATIONS: Record<string, string> = {
  "Authentication failed": "Falló la autenticación",
  "Provider connection unreachable": "No se pudo conectar con el proveedor",
  "Provider returned an invalid response": "El proveedor devolvió una respuesta inválida",
  "Provider request timed out": "La solicitud al proveedor superó el tiempo de espera",
  "Provider rate limit exceeded": "Se superó el límite de solicitudes del proveedor",
  "Internal synchronization error": "Error interno de sincronización",
};

export function translateSyncFailureSummary(failureSummary: string | undefined): string | undefined {
  if (!failureSummary) return undefined;
  const [category, ...rest] = failureSummary.split(" - ");
  const translatedCategory = FAILURE_CATEGORY_TRANSLATIONS[category];
  if (!translatedCategory) return "Ocurrió un error durante la sincronización.";
  return [translatedCategory, ...rest.map((segment) => (segment.startsWith("code ") ? `código ${segment.slice(5)}` : segment))].join(" - ");
}
