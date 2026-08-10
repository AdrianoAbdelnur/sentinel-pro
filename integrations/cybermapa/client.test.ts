import { describe, expect, it, vi } from "vitest";

import type { CybermapaConfig } from "./config";
import {
  CybermapaRequestError,
  createCybermapaClient,
  type CybermapaFetch,
} from "./client";

const config: CybermapaConfig = {
  apiUrl: "https://cybermapa.example/api",
  username: "operator",
  password: "raw-secret",
  timeoutMs: 15_000,
};

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function vehicles(): unknown[] {
  return [{ gps_id: 90001, nombre_empresa: "Transporte Andino", patente: "AB123CD" }];
}

function createClient(fetch: CybermapaFetch, clientConfig: CybermapaConfig = config) {
  return createCybermapaClient({ config: clientConfig, fetch });
}

describe("createCybermapaClient", () => {
  it("posts a GETVEHICULOS action with the configured credentials in the JSON body, never the URL", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(response(vehicles()));
    const client = createClient(fetch);

    await expect(client.fetchVehicles()).resolves.toEqual([
      { gps_id: 90001, nombre_empresa: "Transporte Andino", patente: "AB123CD" },
    ]);
    expect(fetch).toHaveBeenCalledWith(
      "https://cybermapa.example/api",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "GETVEHICULOS",
          user: "operator",
          pwd: "raw-secret",
          empresas: [],
        }),
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it.each([
    [401, "authentication"],
    [403, "authentication"],
    [429, "rate-limited"],
    [500, "invalid-response"],
  ] as const)("translates HTTP %s into category %s", async (status, category) => {
    const fetch = vi.fn().mockResolvedValueOnce(response({}, status));
    const client = createClient(fetch);

    const failure = await client.fetchVehicles().catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(CybermapaRequestError);
    expect((failure as CybermapaRequestError).category).toBe(category);
    expect((failure as CybermapaRequestError).httpStatus).toBe(status);
  });

  it("translates a network failure into a connectivity failure without leaking its raw message", async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new Error("ECONNRESET upstream detail"));
    const client = createClient(fetch);

    const failure = await client.fetchVehicles().catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(CybermapaRequestError);
    expect((failure as CybermapaRequestError).category).toBe("connectivity");
    expect(String(failure)).not.toContain("ECONNRESET");
  });

  it("translates an aborted request into a timeout failure", async () => {
    const timeoutError = new DOMException("The operation timed out.", "TimeoutError");
    const fetch = vi.fn().mockRejectedValueOnce(timeoutError);
    const client = createClient(fetch);

    const failure = await client.fetchVehicles().catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(CybermapaRequestError);
    expect((failure as CybermapaRequestError).category).toBe("timeout");
  });

  it.each([
    ["a non-array top-level payload", { not: "an-array" }],
    ["a wrapped envelope", { data: vehicles() }],
    ["an empty object", {}],
  ] as const)(
    "fails loudly with an invalid-response category instead of a silent empty snapshot for %s",
    async (_label, body) => {
      const fetch = vi.fn().mockResolvedValueOnce(response(body));
      const client = createClient(fetch);

      const outcome = await client.fetchVehicles().then(
        (records) => ({ kind: "resolved" as const, records }),
        (error: unknown) => ({ kind: "rejected" as const, error }),
      );

      expect(outcome.kind).toBe("rejected");
      if (outcome.kind === "rejected") {
        expect(outcome.error).toBeInstanceOf(CybermapaRequestError);
        expect((outcome.error as CybermapaRequestError).category).toBe("invalid-response");
      }
    },
  );

  it("fails loudly with an invalid-response category for a non-JSON or empty body instead of a silent empty snapshot", async () => {
    const nonJsonFetch = vi.fn().mockResolvedValueOnce(new Response("not-json", { status: 200 }));
    const emptyBodyFetch = vi.fn().mockResolvedValueOnce(new Response("", { status: 200 }));

    const nonJsonFailure = await createClient(nonJsonFetch)
      .fetchVehicles()
      .catch((error: unknown) => error);
    const emptyBodyFailure = await createClient(emptyBodyFetch)
      .fetchVehicles()
      .catch((error: unknown) => error);

    expect(nonJsonFailure).toBeInstanceOf(CybermapaRequestError);
    expect((nonJsonFailure as CybermapaRequestError).category).toBe("invalid-response");
    expect(emptyBodyFailure).toBeInstanceOf(CybermapaRequestError);
    expect((emptyBodyFailure as CybermapaRequestError).category).toBe("invalid-response");
  });

  it("accepts a genuinely empty vehicle array as a valid (if empty) result, distinct from a malformed envelope", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(response([]));
    const client = createClient(fetch);

    await expect(client.fetchVehicles()).resolves.toEqual([]);
  });

  it("never leaks the configured credentials through a thrown failure", async () => {
    const secretConfig: CybermapaConfig = {
      ...config,
      username: "canary-user-9f2",
      password: "canary-pass-7k3",
    };
    const fetch = vi.fn().mockRejectedValueOnce(new Error("network down"));
    const client = createClient(fetch, secretConfig);

    const failure = await client.fetchVehicles().catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(CybermapaRequestError);
    expect(String(failure)).not.toContain("canary-user-9f2");
    expect(String(failure)).not.toContain("canary-pass-7k3");
    expect(JSON.stringify(failure)).not.toContain("canary-pass-7k3");
  });

  it("never leaks the configured credentials through a successful result or the request URL", async () => {
    const secretConfig: CybermapaConfig = {
      ...config,
      username: "canary-user-9f2",
      password: "canary-pass-7k3",
    };
    const fetch = vi.fn().mockResolvedValueOnce(response(vehicles()));
    const client = createClient(fetch, secretConfig);

    const records = await client.fetchVehicles();

    expect(JSON.stringify(records)).not.toContain("canary-pass-7k3");
    const [calledUrl] = fetch.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).not.toContain("canary-pass-7k3");
    expect(calledUrl).not.toContain("canary-user-9f2");
  });
});
