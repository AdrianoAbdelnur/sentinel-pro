import type { CatalogSyncFailureCategory } from "@/application/catalog/synchronize-connection";

import type { CybermapaConfig } from "./config";
import {
  parseCybermapaCurrentDataResponse,
  parseCybermapaVehiclesResponse,
  type CybermapaCurrentDataRecord,
  type CybermapaVehicleRecord,
} from "./responses";

export class CybermapaRequestError extends Error {
  readonly category: CatalogSyncFailureCategory;
  readonly httpStatus?: number;

  constructor(category: CatalogSyncFailureCategory, httpStatus?: number) {
    super("Cybermapa request failed");
    this.name = "CybermapaRequestError";
    this.category = category;
    this.httpStatus = httpStatus;
  }
}

export type CybermapaFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

type CreateCybermapaClientInput = {
  config: CybermapaConfig;
  fetch?: CybermapaFetch;
};

export type CybermapaClient = {
  fetchVehicles(): Promise<CybermapaVehicleRecord[]>;
  fetchCurrentData(identifiers: readonly string[], identifierType?: "gps" | "patente"): Promise<CybermapaCurrentDataRecord[]>;
};

function statusCategory(status: number): CatalogSyncFailureCategory {
  if (status === 401 || status === 403) return "authentication";
  if (status === 429) return "rate-limited";
  return "invalid-response";
}

function isTimeoutError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === "TimeoutError"
  );
}

function vehiclesRequestBody(config: CybermapaConfig): string {
  return JSON.stringify({
    action: "GETVEHICULOS",
    user: config.username,
    pwd: config.password,
    empresas: [],
  });
}

function currentDataRequestBody(config: CybermapaConfig, identifiers: readonly string[], identifierType: "gps" | "patente"): string {
  return JSON.stringify({
    action: "DATOSACTUALES",
    user: config.username,
    pwd: config.password,
    vehiculos: identifiers,
    tipoID: identifierType,
  });
}

async function request(config: CybermapaConfig, body: string, fetch: CybermapaFetch): Promise<unknown> {
  let response: Response;

  try {
    response = await fetch(config.apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(config.timeoutMs),
      cache: "no-store",
    });
  } catch (error) {
    throw new CybermapaRequestError(isTimeoutError(error) ? "timeout" : "connectivity");
  }

  if (!response.ok) {
    throw new CybermapaRequestError(statusCategory(response.status), response.status);
  }

  try {
    return await response.json();
  } catch {
    throw new CybermapaRequestError("invalid-response", response.status);
  }
}

export function createCybermapaClient({
  config,
  fetch = globalThis.fetch,
}: CreateCybermapaClientInput): CybermapaClient {
  return {
    async fetchVehicles() {
      const payload = await request(config, vehiclesRequestBody(config), fetch);

      try {
        return parseCybermapaVehiclesResponse(payload);
      } catch {
        throw new CybermapaRequestError("invalid-response");
      }
    },
    async fetchCurrentData(identifiers, identifierType = "patente") {
      if (identifiers.length === 0) return [];

      const payload = await request(config, currentDataRequestBody(config, identifiers, identifierType), fetch);
      try {
        return parseCybermapaCurrentDataResponse(payload);
      } catch {
        throw new CybermapaRequestError("invalid-response");
      }
    },
  };
}
