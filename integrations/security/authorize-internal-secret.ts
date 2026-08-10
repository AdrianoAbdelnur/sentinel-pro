import { createHash, timingSafeEqual } from "node:crypto";

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

export function isValidInternalSecret(candidate: string, expectedSecret: string): boolean {
  return timingSafeEqual(digest(candidate), digest(expectedSecret));
}
