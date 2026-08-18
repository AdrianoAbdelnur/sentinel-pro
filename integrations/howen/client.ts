import type { HowenConfig } from "./config";
import { HowenSessionError } from "./session";
import { parseHowenRosterResponse, type HowenRosterRecord } from "./responses";
import type {
  HowenFetch,
  HowenSession,
  HowenSessionManager,
} from "./session";
import type { CatalogSyncFailureCategory } from "@/application/catalog/synchronize-connection";

type CreateHowenClientInput = {
  config: HowenConfig;
  session: HowenSessionManager;
  fetch?: HowenFetch;
};

export class HowenRequestError extends Error {
  readonly category: CatalogSyncFailureCategory;
  readonly httpStatus?: number;

  constructor(category: CatalogSyncFailureCategory, httpStatus?: number) {
    super("Howen request unavailable");
    this.name = "HowenRequestError";
    this.category = category;
    this.httpStatus = httpStatus;
  }
}

export type HowenClient = {
  fetchRoster(): Promise<HowenRosterRecord[]>;
};

function unavailable(category: CatalogSyncFailureCategory = "connectivity", httpStatus?: number): HowenRequestError {
  return new HowenRequestError(category, httpStatus);
}

function providerStatus(value: unknown): number | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const status = (value as Record<string, unknown>).status;
  return typeof status === "number" ? status : undefined;
}

function isExpired(status: number | undefined): boolean {
  return status === 10004 || status === 10023;
}

export function createHowenClient({
  config,
  session,
  fetch = globalThis.fetch,
}: CreateHowenClientInput): HowenClient {
  const requestRoster = async (
    hasRetried: boolean,
  ): Promise<HowenRosterRecord[]> => {
    const activeSession = await session.getSession();
    let response: Response;
    let payload: unknown;

    try {
      response = await fetch(
        `${config.baseUrl}/vss/vehicle/findAll.action`,
        rosterRequest(activeSession, config.timeoutMs),
      );
    } catch (error) {
      if (error instanceof HowenRequestError) throw error;
      throw unavailable((error as { name?: string }).name === "TimeoutError" ? "timeout" : "connectivity");
    }

    try {
      payload = await response.json();
    } catch {
      throw unavailable("invalid-response", response.status);
    }

    const status = providerStatus(payload);

    if (isExpired(status)) {
      session.invalidate(activeSession);

      if (!hasRetried) {
        return requestRoster(true);
      }

      throw unavailable("authentication", typeof status === "number" ? status : response.status);
    }

    if (!response.ok || status !== 10000) {
      throw unavailable(response.status === 401 || response.status === 403 ? "authentication" : "invalid-response", response.status);
    }

    session.recordAuthenticatedActivity(activeSession);

    try {
      return parseHowenRosterResponse(payload);
    } catch (error) {
      if (error instanceof HowenRequestError) throw error;
      throw unavailable("invalid-response", response.status);
    }
  };

  return {
    async fetchRoster() {
      try {
        return await requestRoster(false);
      } catch (error) {
        if (error instanceof HowenSessionError) throw unavailable(error.category, error.httpStatus);
        if (error instanceof HowenRequestError) throw error;
        throw unavailable("internal");
      }
    },
  };
}

function rosterRequest(
  session: HowenSession,
  timeoutMs: number,
): RequestInit {
  return {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: session.cookie,
    },
    body: JSON.stringify({
      token: session.token,
      pageNum: -1,
      pageCount: -1,
    }),
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  };
}
