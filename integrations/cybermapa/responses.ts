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

export type CybermapaCurrentDataRecord = {
  nombre?: string;
  alias?: string;
  patente?: string;
  gps?: string;
  latitud?: string;
  longitud?: string;
  fecha?: string;
  sentido?: string;
  velocidad?: string;
  evento?: string;
  [key: string]: string | undefined;
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

const currentDataFields = [
  "nombre",
  "alias",
  "patente",
  "gps",
  "latitud",
  "longitud",
  "fecha",
  "sentido",
  "velocidad",
  "evento",
] as const;

function parseCurrentDataRecord(value: unknown): CybermapaCurrentDataRecord | undefined {
  if (!isObject(value)) return undefined;

  const record: CybermapaCurrentDataRecord = {};
  const aliases: Partial<Record<typeof currentDataFields[number], readonly string[]>> = {
    fecha: ["fecha", "FECHA", "FECHA_COMUNICACION"],
  };
  for (const field of currentDataFields) {
    const candidate = (aliases[field] ?? [field, field.toUpperCase()])
      .map((alias) => value[alias])
      .find((candidate) => candidate !== undefined);
    if (typeof candidate === "string" || typeof candidate === "number") {
      record[field] = String(candidate);
    }
  }

  return record;
}

export function parseCybermapaCurrentDataResponse(value: unknown): CybermapaCurrentDataRecord[] {
  if (!Array.isArray(value)) {
    throw new Error("Invalid Cybermapa current data response");
  }

  return value.flatMap((item) => {
    const record = parseCurrentDataRecord(item);
    return record ? [record] : [];
  });
}
