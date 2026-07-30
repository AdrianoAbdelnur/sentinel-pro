import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import {
  HOWEN_INACTIVITY_THRESHOLD_MS,
  readHowenConfig,
  type HowenConfig,
} from "./config";
import { createHowenSessionManager } from "./session";

const config: HowenConfig = {
  baseUrl: "https://howen.example",
  username: "operator",
  password: "raw-secret",
  timeoutMs: 15_000,
  inactivityThresholdMs: 25 * 60 * 1000,
};

function loginResponse(
  token: string,
  pid: string,
  cookie = "JSESSIONID=session-id; Path=/; HttpOnly",
): Response {
  return new Response(
    JSON.stringify({ status: 10000, data: { token, pid } }),
    { status: 200, headers: { "set-cookie": cookie } },
  );
}

describe("createHowenSessionManager", () => {
  it("reads trimmed server configuration with safe defaults", () => {
    expect(
      readHowenConfig({
        HOWEN_BASE_URL: " https://howen.example/ ",
        HOWEN_USERNAME: " operator ",
        HOWEN_PASSWORD: " raw-secret ",
      }),
    ).toEqual({
      baseUrl: "https://howen.example",
      username: "operator",
      password: "raw-secret",
      timeoutMs: 15_000,
      inactivityThresholdMs: HOWEN_INACTIVITY_THRESHOLD_MS,
    });
  });

  it("rejects incomplete or invalid server configuration safely", () => {
    expect(() => readHowenConfig({})).toThrow(
      "Howen configuration unavailable",
    );
    expect(() =>
      readHowenConfig({
        HOWEN_BASE_URL: "not-a-url",
        HOWEN_USERNAME: "operator",
        HOWEN_PASSWORD: "raw-secret",
      }),
    ).toThrow("Howen configuration unavailable");
  });

  it("MD5-hashes raw credentials and retains the complete session", async () => {
    const fetch = vi.fn(async () => loginResponse("token-1", "pid-1"));
    const manager = createHowenSessionManager({ config, fetch });

    const session = await manager.getSession();

    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(
      "https://howen.example/vss/user/apiLogin.action",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          username: "operator",
          password: createHash("md5").update("raw-secret").digest("hex"),
        }),
      }),
    );
    expect(session).toEqual({
      token: "token-1",
      pid: "pid-1",
      cookie: "JSESSIONID=session-id",
    });
  });

  it("coalesces concurrent logins and shares their session", async () => {
    let releaseLogin: ((response: Response) => void) | undefined;
    const fetch = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          releaseLogin = resolve;
        }),
    );
    const manager = createHowenSessionManager({ config, fetch });

    const first = manager.getSession();
    const second = manager.getSession();
    releaseLogin?.(loginResponse("shared-token", "shared-pid"));

    await expect(Promise.all([first, second])).resolves.toEqual([
      {
        token: "shared-token",
        pid: "shared-pid",
        cookie: "JSESSIONID=session-id",
      },
      {
        token: "shared-token",
        pid: "shared-pid",
        cookie: "JSESSIONID=session-id",
      },
    ]);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("reuses active sessions and renews on the first request after inactivity", async () => {
    let nowMs = 0;
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(loginResponse("token-1", "pid-1"))
      .mockResolvedValueOnce(loginResponse("token-2", "pid-2"));
    const manager = createHowenSessionManager({
      config,
      fetch,
      now: () => nowMs,
    });

    const initial = await manager.getSession();
    nowMs = 24 * 60 * 1000;
    manager.recordAuthenticatedActivity(initial);
    nowMs = 48 * 60 * 1000;

    await expect(manager.getSession()).resolves.toMatchObject({
      token: "token-1",
    });

    nowMs = 50 * 60 * 1000;

    await expect(manager.getSession()).resolves.toMatchObject({
      token: "token-2",
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("invalidates only the session that encountered an expiry response", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(loginResponse("token-1", "pid-1"))
      .mockResolvedValueOnce(loginResponse("token-2", "pid-2"));
    const manager = createHowenSessionManager({ config, fetch });
    const first = await manager.getSession();

    manager.invalidate(first);
    const second = await manager.getSession();
    manager.invalidate(first);

    await expect(manager.getSession()).resolves.toEqual(second);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("rejects incomplete login sessions without leaking credentials", async () => {
    const fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          status: 10000,
          data: { token: "token-1", pid: "pid-1" },
        }),
        { status: 200 },
      ),
    );
    const manager = createHowenSessionManager({ config, fetch });

    const failure = await manager.getSession().catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toBe("Howen request unavailable");
    expect(String(failure)).not.toContain("raw-secret");
    expect(String(failure)).not.toContain("token-1");
  });
});
