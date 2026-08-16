import { describe, expect, it, vi } from "vitest";

import type { HowenConfig } from "./config";
import { createHowenClient } from "./client";
import {
  createHowenSessionManager,
  type HowenFetch,
} from "./session";

const config: HowenConfig = {
  baseUrl: "https://howen.example",
  username: "operator",
  password: "raw-secret",
  timeoutMs: 15_000,
  inactivityThresholdMs: 25 * 60 * 1000,
};

function response(body: unknown, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), { status: 200, headers });
}

function login(token: string): Response {
  return response(
    { status: 10000, data: { token, pid: `pid-${token}` } },
    { "set-cookie": `JSESSIONID=cookie-${token}; Path=/` },
  );
}

function roster(deviceNumber = "device-1"): Response {
  return response({
    status: 10000,
    data: {
      dataList: [
        {
          deviceno: deviceNumber,
          devicename: "AA264KK",
          fleetid: "fleet-1",
          fleetname: "Travil SAS",
        },
      ],
    },
  });
}

function createClient(
  fetch: HowenFetch,
  now: () => number = () => 0,
) {
  const session = createHowenSessionManager({ config, fetch, now });
  return createHowenClient({ config, fetch, session });
}

describe("createHowenClient", () => {
  it("requests the complete roster with the token and session cookie", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(login("token-1"))
      .mockResolvedValueOnce(roster());
    const client = createClient(fetch);

    await expect(client.fetchRoster()).resolves.toEqual([
      expect.objectContaining({ deviceno: "device-1" }),
    ]);
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "https://howen.example/vss/vehicle/findAll.action",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Cookie: "JSESSIONID=cookie-token-1",
        }),
        body: JSON.stringify({
          token: "token-1",
          pageNum: -1,
          pageCount: -1,
        }),
      }),
    );
  });

  it("records successful roster activity for later session reuse", async () => {
    let nowMs = 0;
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(login("token-1"))
      .mockResolvedValueOnce(roster("device-1"))
      .mockResolvedValueOnce(roster("device-2"));
    const client = createClient(fetch, () => nowMs);

    nowMs = 24 * 60 * 1000;
    await client.fetchRoster();
    nowMs = 48 * 60 * 1000;

    await expect(client.fetchRoster()).resolves.toEqual([
      expect.objectContaining({ deviceno: "device-2" }),
    ]);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it.each([10004, 10023])(
    "reauthenticates and retries once after provider code %s",
    async (providerCode) => {
      const fetch = vi
        .fn()
        .mockResolvedValueOnce(login("token-1"))
        .mockResolvedValueOnce(response({ status: providerCode, data: null }))
        .mockResolvedValueOnce(login("token-2"))
        .mockResolvedValueOnce(roster("device-after-retry"));
      const client = createClient(fetch);

      await expect(client.fetchRoster()).resolves.toEqual([
        expect.objectContaining({ deviceno: "device-after-retry" }),
      ]);
      expect(fetch).toHaveBeenCalledTimes(4);
    },
  );

  it("stops after one retry when session expiry repeats", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(login("token-1"))
      .mockResolvedValueOnce(response({ status: 10004, data: null }))
      .mockResolvedValueOnce(login("token-2"))
      .mockResolvedValueOnce(response({ status: 10023, data: null }));
    const client = createClient(fetch);

    await expect(client.fetchRoster()).rejects.toThrow(
      "Howen request unavailable",
    );
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it("does not retry unrecognized provider failures", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(login("token-1"))
      .mockResolvedValueOnce(response({ status: 10003, data: null }));
    const client = createClient(fetch);

    await expect(client.fetchRoster()).rejects.toThrow(
      "Howen request unavailable",
    );
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("translates aborted transport without leaking the raw failure", async () => {
    const rawFailure = new Error(
      "AbortError raw-secret token-should-not-leak status=504",
    );
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(login("token-1"))
      .mockRejectedValueOnce(rawFailure);
    const client = createClient(fetch);

    const failure = await client.fetchRoster().catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toBe("Howen request unavailable");
    expect(String(failure)).not.toContain("raw-secret");
    expect(String(failure)).not.toContain("504");
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("classifies malformed login JSON as an invalid provider response", async () => {
    const malformedLogin = new Response("not-json", { status: 200 });
    const fetch = vi.fn().mockResolvedValueOnce(malformedLogin);
    const client = createClient(fetch);

    const failure = await client.fetchRoster().catch((error: unknown) => error) as { category?: string };

    expect(failure.category).toBe("invalid-response");
  });
});
