export type CybermapaVehicleRecord = {
  id?: number | string;
  gps_id?: number | string;
  gps_identificador?: string;
  alias?: string;
  anio?: number | string;
  color?: string;
  consumo?: number | string;
  descripcion?: string;
  marca?: string;
  modelo?: string;
  nombre?: string;
  nombre_empresa?: string;
  nombre_modulo?: string;
  patente?: string;
};

const stringFields = [
  "gps_identificador",
  "alias",
  "color",
  "descripcion",
  "marca",
  "modelo",
  "nombre",
  "nombre_empresa",
  "nombre_modulo",
  "patente",
] as const;
const numericFields = ["id", "gps_id", "anio", "consumo"] as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRecord(value: unknown): CybermapaVehicleRecord | undefined {
  if (!isObject(value)) {
    return undefined;
  }

  const record: CybermapaVehicleRecord = {};

  for (const field of stringFields) {
    if (typeof value[field] === "string") {
      record[field] = value[field] as string;
    }
  }

  for (const field of numericFields) {
    const candidate = value[field];
    if (typeof candidate === "number" || typeof candidate === "string") {
      record[field] = candidate;
    }
  }

  return record;
}

export function parseCybermapaVehiclesResponse(value: unknown): CybermapaVehicleRecord[] {
  if (!Array.isArray(value)) {
    throw new Error("Invalid Cybermapa vehicles response");
  }

  const records = value.flatMap((item) => {
    const record = parseRecord(item);
    return record ? [record] : [];
  });
  Object.defineProperty(records, "receivedRecordCount", { value: value.length });
  return records;
}
