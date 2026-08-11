import { beforeEach, describe, expect, it, vi } from "vitest";

import { requestCatalogApi } from "./catalog-client";

const PATH = "/api/admin/catalog/connections/conn-1/sync";

describe("requestCatalogApi", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));

  it("returns the parsed payload on a successful response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ status: "succeeded" }), { status: 200 }));
    const result = await requestCatalogApi(PATH, { method: "POST" });
    expect(fetch).toHaveBeenCalledWith(PATH, { method: "POST", headers: { "content-type": "application/json" } });
    expect(result).toEqual({ status: "succeeded" });
  });

  it("falls back to Spanish messages for a missing error field, an HTTP failure, and a network failure", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ error: "Este proveedor todavía no admite sincronización." }), { status: 409 }));
    expect((await requestCatalogApi(PATH, { method: "POST" })).error).toBe("Este proveedor todavía no admite sincronización.");
    vi.mocked(fetch).mockResolvedValueOnce(new Response("internal failure", { status: 500 }));
    expect((await requestCatalogApi(PATH, { method: "POST" })).error).toBe("La solicitud falló (500).");
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network failed"));
    expect((await requestCatalogApi(PATH, { method: "POST" })).error).toBe("No pudimos completar la solicitud.");
  });
});
