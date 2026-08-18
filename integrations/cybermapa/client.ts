import type { GlobalSyncFailureCategory } from "@/application/catalog/synchronize-global-connection";

import type { CybermapaConfig } from "./config";
import { parseCybermapaVehiclesResponse, type CybermapaVehicleRecord } from "./responses";

export class CybermapaRequestError extends Error {
  readonly category: GlobalSyncFailureCategory;
  readonly httpStatus?: number;

  constructor(category: GlobalSyncFailureCategory, httpStatus?: number) {
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
};

function statusCategory(status: number): GlobalSyncFailureCategory {
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

export function createCybermapaClient({
  config,
  fetch = globalThis.fetch,
}: CreateCybermapaClientInput): CybermapaClient {
  return {
    async fetchVehicles() {
      let response: Response;

      try {
        response = await fetch(config.apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: vehiclesRequestBody(config),
          signal: AbortSignal.timeout(config.timeoutMs),
          cache: "no-store",
        });
      } catch (error) {
        throw new CybermapaRequestError(isTimeoutError(error) ? "timeout" : "connectivity");
      }

      if (!response.ok) {
        throw new CybermapaRequestError(statusCategory(response.status), response.status);
      }

      let payload: unknown;

      try {
        payload = await response.json();
      } catch {
        throw new CybermapaRequestError("invalid-response", response.status);
      }

      try {
        return parseCybermapaVehiclesResponse(payload);
      } catch {
        throw new CybermapaRequestError("invalid-response", response.status);
      }
    },
  };
}
