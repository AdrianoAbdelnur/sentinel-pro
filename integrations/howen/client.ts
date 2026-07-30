import type { HowenConfig } from "./config";
import { parseHowenRosterResponse, type HowenRosterRecord } from "./responses";
import type {
  HowenFetch,
  HowenSession,
  HowenSessionManager,
} from "./session";

type CreateHowenClientInput = {
  config: HowenConfig;
  session: HowenSessionManager;
  fetch?: HowenFetch;
};

export type HowenClient = {
  fetchRoster(): Promise<HowenRosterRecord[]>;
};

function unavailable(): Error {
  return new Error("Howen request unavailable");
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
      payload = await response.json();
    } catch {
      throw unavailable();
    }

    const status = providerStatus(payload);

    if (isExpired(status)) {
      session.invalidate(activeSession);

      if (!hasRetried) {
        return requestRoster(true);
      }

      throw unavailable();
    }

    if (!response.ok || status !== 10000) {
      throw unavailable();
    }

    session.recordAuthenticatedActivity(activeSession);

    try {
      return parseHowenRosterResponse(payload);
    } catch {
      throw unavailable();
    }
  };

  return {
    async fetchRoster() {
      try {
        return await requestRoster(false);
      } catch {
        throw unavailable();
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
