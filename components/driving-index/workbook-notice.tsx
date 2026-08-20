import type { WorkbookParseFailureCode } from "@/application/driving-index/contracts";

type WorkbookNoticeProps = {
  code: WorkbookParseFailureCode;
};

const NOTICE_COPY: Record<WorkbookParseFailureCode, string> = {
  "unreadable-file": "No se pudo leer el archivo. Verificá que sea una planilla .xlsx válida e intentá de nuevo.",
  "missing-plate-column": "No se encontró una columna Dominio en la planilla. Revisá los encabezados y volvé a subirla.",
  "no-usable-rows": "No se encontraron vehículos con Dominio en la planilla. Revisá el contenido antes de subirla de nuevo.",
};

export function WorkbookNotice({ code }: WorkbookNoticeProps) {
  return (
    <p role="status" aria-live="polite" className="rounded border border-amber-400/30 bg-amber-400/[0.06] px-3 py-2 text-sm text-amber-100">
      {NOTICE_COPY[code]}
    </p>
  );
}
