import { describe, expect, it } from "vitest";

import { toSessionDocument } from "./documents";

describe("session document mapping", () => {
  it("omits an undefined active organization so strict MongoDB validation accepts login sessions", () => {
    const now = new Date("2026-08-06T00:00:00.000Z");
    const document = toSessionDocument({ id: "session", tokenHash: "hash", userId: "user", activeOrganizationId: undefined, lastActivityAt: now, expiresAt: now, createdAt: now });

    expect(document).not.toHaveProperty("activeOrganizationId");
  });
});
