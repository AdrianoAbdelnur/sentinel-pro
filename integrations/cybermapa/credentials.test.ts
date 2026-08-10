import { describe, expect, it } from "vitest";

import { isCredentialRef } from "@/domain/catalog";

import { buildCybermapaCredentialRef } from "./credentials";

describe("buildCybermapaCredentialRef", () => {
  it("builds a Cybermapa-scoped vault reference from the tenant identifier only", () => {
    expect(buildCybermapaCredentialRef("org-a")).toBe("vault:cybermapa/org-a");
  });

  it("produces a value that always satisfies the closed credential reference grammar", () => {
    expect(isCredentialRef(buildCybermapaCredentialRef("org-a"))).toBe(true);
  });

  it("has no parameter through which a raw secret could be supplied", () => {
    expect(buildCybermapaCredentialRef.length).toBe(1);
  });
});
