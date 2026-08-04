import { describe, expect, it } from "vitest";

import { parseHowenTimestamp } from "./parse-howen-timestamp";

describe("parseHowenTimestamp", () => {
  it("interprets zone-less provider time in Buenos Aires", () => {
    expect(parseHowenTimestamp("2026-07-29 21:00:00")).toBe(
      "2026-07-30T00:00:00.000Z",
    );
  });

  it.each([
    "",
    "2026-02-30 12:00:00",
    "2026-07-29T21:00:00Z",
    "not-a-date",
  ])("omits malformed provider time", (value) => {
    expect(parseHowenTimestamp(value)).toBeUndefined();
  });
});
