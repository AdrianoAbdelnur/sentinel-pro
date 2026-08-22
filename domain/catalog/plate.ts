export function normalizePlate(plate: string): string {
  return plate.trim().toUpperCase().replace(/[\s-]+/g, "");
}

export function isValidNormalizedPlate(plate: string): boolean {
  return /^(?:[A-Z]{3}\d{3}|[A-Z]{2}\d{3}[A-Z]{2})$/.test(plate);
}
