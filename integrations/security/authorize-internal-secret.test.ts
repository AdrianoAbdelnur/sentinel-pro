import { describe, expect, it } from "vitest";
import { isValidInternalSecret } from "./authorize-internal-secret";

const SECRET = "sentinel-catalog-sync-secret-value";

describe("isValidInternalSecret", () => {
  it("accepts the exact configured secret", () => {
    expect(isValidInternalSecret(SECRET, SECRET)).toBe(true);
  });

  it("rejects a different candidate of the same length", () => {
    expect(isValidInternalSecret("x".repeat(SECRET.length), SECRET)).toBe(false);
  });

  it("rejects a shorter candidate without throwing, so a length mismatch cannot surface as a distinguishable error", () => {
    expect(() => isValidInternalSecret("short", SECRET)).not.toThrow();
    expect(isValidInternalSecret("short", SECRET)).toBe(false);
  });

  it("rejects a longer candidate without throwing", () => {
    expect(() => isValidInternalSecret(`${SECRET}-and-more`, SECRET)).not.toThrow();
    expect(isValidInternalSecret(`${SECRET}-and-more`, SECRET)).toBe(false);
  });

  it("rejects an empty candidate", () => {
    expect(isValidInternalSecret("", SECRET)).toBe(false);
  });
});
