import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

describe("proxy", () => {
  it("redirects protected requests without a session cookie", () => {
    const response = proxy(new NextRequest("https://sentinel.test/admin/users"));
    expect(response.headers.get("location")).toBe("https://sentinel.test/login");
  });

  it("optimistically renews a present opaque session without authorizing it", () => {
    const response = proxy(new NextRequest("https://sentinel.test/admin/users", { headers: { cookie: "__Host-sentinel_session=opaque" } }));
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("set-cookie")).toContain("__Host-sentinel_session=opaque");
  });
});
