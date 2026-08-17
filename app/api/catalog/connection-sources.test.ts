import { afterEach, describe, expect, it, vi } from "vitest";

import { createDefaultConnectionSourceFactories } from "./connection-sources";

describe("default connection source factories", () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each(["preview", "company-1"])(
    "resolves a Howen source for the transient scope %s",
    (companyId) => {
      vi.stubEnv("HOWEN_BASE_URL", "https://howen.example");
      vi.stubEnv("HOWEN_USERNAME", "operator");
      vi.stubEnv("HOWEN_PASSWORD", "secret");

      const source = createDefaultConnectionSourceFactories().howen?.(
        {
          id: "provider-import",
          organizationId: "provider-import",
          credentialRef: "vault:howen/provider-import",
          companyId,
        },
      );

      expect(source).toBeDefined();
    },
  );
});
