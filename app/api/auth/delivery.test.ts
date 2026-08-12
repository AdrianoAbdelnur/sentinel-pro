import { describe, expect, it } from "vitest";

import { getSessionCookieName, getSessionCookieOptions, readSessionToken } from "./delivery";

describe("session cookie delivery", () => {
  it("uses a browser-compatible cookie for local HTTP development", () => {
    const request = new Request("http://192.168.56.1:3000/live", {
      headers: { cookie: "sentinel_session=local-token" },
    });

    expect(getSessionCookieName(request)).toBe("sentinel_session");
    expect(getSessionCookieOptions(request).secure).toBe(false);
    expect(readSessionToken(request)).toBe("local-token");
  });

  it("keeps the host-only secure cookie in HTTPS", () => {
    const request = new Request("https://sentinel.test/live", {
      headers: { cookie: "__Host-sentinel_session=secure-token" },
    });

    expect(getSessionCookieName(request)).toBe("__Host-sentinel_session");
    expect(getSessionCookieOptions(request).secure).toBe(true);
    expect(readSessionToken(request)).toBe("secure-token");
  });

  it("accepts the alternate session cookie during local development", () => {
    const request = new Request("http://192.168.56.1:3000/admin/import", {
      headers: { cookie: "__Host-sentinel_session=secure-token" },
    });

    expect(readSessionToken(request)).toBe("secure-token");
  });
});
