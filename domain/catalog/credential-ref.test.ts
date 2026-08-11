import { describe, expect, it } from "vitest";

import { isCredentialRef, resolveCredentialRefProvider, toCredentialRef } from "./credential-ref";

describe("credential reference guard", () => {
  it("accepts a legitimate vault-scoped reference", () => {
    expect(isCredentialRef("vault:cybermapa/org-a")).toBe(true);
  });

  it.each([
    "sk-live-4242424242424242",
    "Bearer sk-live-abc123",
    "hunter2",
    "https://svc:hunter2@cybermapa.example.com",
    "vault:cybermapa/org a",
    "vault:/org-a",
    "",
  ])("rejects a raw-looking or malformed value: %s", (value) => {
    expect(isCredentialRef(value)).toBe(false);
  });

  it("builds a valid reference from a provider and an opaque business identifier", () => {
    expect(toCredentialRef("cybermapa", "org-a")).toBe("vault:cybermapa/org-a");
  });

  it("refuses to build a reference outside the closed grammar", () => {
    expect(() => toCredentialRef("cybermapa", "org a")).toThrow("Invalid credential reference");
  });

  it("refuses to build a reference from a raw-secret-shaped business identifier", () => {
    expect(() => toCredentialRef("cybermapa", "sk-live-topsecret1234567890@evil")).toThrow(
      "Invalid credential reference",
    );
  });

  it("extracts the provider prefix from a well-formed vault reference", () => {
    expect(resolveCredentialRefProvider("vault:cybermapa/org-a")).toBe("cybermapa");
    expect(resolveCredentialRefProvider("vault:howen/org-b")).toBe("howen");
  });

  it("returns undefined for a reference with no recognizable provider prefix", () => {
    expect(resolveCredentialRefProvider("not-a-vault-ref")).toBeUndefined();
  });
});
