export function normalizePlate(plate: string): string {
  return plate.trim().replace(/[\s\-._/\u200B-\u200D\uFEFF]+/g, "").toUpperCase();
}

export type PlateFormat = "legacy" | "mercosur" | "unknown";

export function classifyPlateFormat(canonicalPlate: string): PlateFormat {
  if (/^[A-Z]{3}\d{3}$/.test(canonicalPlate)) return "legacy";
  if (/^[A-Z]{2}\d{3}[A-Z]{2}$/.test(canonicalPlate)) return "mercosur";
  return "unknown";
}

export function isValidNormalizedPlate(plate: string): boolean {
  return /^(?:[A-Z]{3}\d{3}|[A-Z]{2}\d{3}[A-Z]{2})$/.test(plate);
}
