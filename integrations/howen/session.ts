import { createHash } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import type { HowenConfig } from "./config";
import type { GlobalSyncFailureCategory } from "@/application/catalog-global/synchronize-global-connection";

export type HowenSession = {
  token: string;
  pid: string;
  cookie: string;
};

export type HowenSessionManager = {
  getSession(): Promise<HowenSession>;
  recordAuthenticatedActivity(session: HowenSession): void;
  invalidate(session: HowenSession): void;
};

export type HowenFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

type CreateHowenSessionManagerInput = {
  config: HowenConfig;
  fetch?: HowenFetch;
  now?: () => number;
};

type PersistedSession = HowenSession & { expiresAtMs: number };

type CachedSession = {
  value: HowenSession;
  lastActivityAtMs: number;
};

export class HowenSessionError extends Error {
  readonly category: GlobalSyncFailureCategory;
  readonly httpStatus?: number;

  constructor(category: GlobalSyncFailureCategory, httpStatus?: number) {
    super("Howen request unavailable");
    this.name = "HowenSessionError";
    this.category = category;
    this.httpStatus = httpStatus;
  }
}

function unavailable(category: GlobalSyncFailureCategory = "connectivity", httpStatus?: number): HowenSessionError {
  return new HowenSessionError(category, httpStatus);
}

function jsessionCookie(response: Response): string | undefined {
  const headers = response.headers as Headers & {
    getSetCookie?: () => string[];
  };
  const values = headers.getSetCookie?.() ?? [
    response.headers.get("set-cookie") ?? "",
  ];

  for (const value of values) {
    const cookie = value
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith("JSESSIONID="));

    if (cookie && cookie.length > "JSESSIONID=".length) {
      return cookie;
    }
  }

  return undefined;
}

function sessionData(value: unknown): { token: string; pid: string } | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const envelope = value as Record<string, unknown>;
  const data = envelope.data;

  if (
    envelope.status !== 10000 ||
    typeof data !== "object" ||
    data === null
  ) {
    return undefined;
  }

  const values = data as Record<string, unknown>;
  const token = typeof values.token === "string" ? values.token.trim() : "";
  const pid = typeof values.pid === "string" ? values.pid.trim() : "";

  return token && pid ? { token, pid } : undefined;
}

export function createHowenSessionManager({
  config,
  fetch = globalThis.fetch,
  now = Date.now,
}: CreateHowenSessionManagerInput): HowenSessionManager {
  let cached: CachedSession | undefined;
  let loginInFlight: Promise<HowenSession> | undefined;
  let hydrationInFlight: Promise<void> | undefined;

  const persist = async (session: HowenSession, expiresAtMs: number) => {
    if (!config.sessionPersistPath) return;
    await mkdir(path.dirname(config.sessionPersistPath), { recursive: true });
    await writeFile(config.sessionPersistPath, JSON.stringify({ ...session, expiresAtMs }), "utf8");
  };

  const hydrate = async () => {
    if (!config.sessionPersistPath || cached) return;
    try {
      const value = JSON.parse(await readFile(config.sessionPersistPath, "utf8")) as Partial<PersistedSession>;
      if (typeof value.token !== "string" || typeof value.pid !== "string" || typeof value.cookie !== "string" || typeof value.expiresAtMs !== "number" || value.expiresAtMs <= now()) return;
      cached = { value: { token: value.token, pid: value.pid, cookie: value.cookie }, lastActivityAtMs: now() };
    } catch {
      return;
    }
  };

  const login = async (): Promise<HowenSession> => {
    try {
      const response = await fetch(
        `${config.baseUrl}/vss/user/apiLogin.action`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: config.username,
            password: createHash("md5")
              .update(config.password)
              .digest("hex"),
          }),
          signal: AbortSignal.timeout(config.timeoutMs),
          cache: "no-store",
        },
      );
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw unavailable("invalid-response", response.status);
      }
      const data = response.ok ? sessionData(payload) : undefined;
      const cookie = response.ok ? jsessionCookie(response) : undefined;

      if (!data || !cookie) {
        throw unavailable(response.ok ? "invalid-response" : response.status === 401 || response.status === 403 ? "authentication" : "invalid-response", response.status);
      }

      const value = { ...data, cookie };
      const lastActivityAtMs = now();
      cached = { value, lastActivityAtMs };
      await persist(value, lastActivityAtMs + config.inactivityThresholdMs);
      return value;
    } catch (error) {
      if (error instanceof HowenSessionError) throw error;
      throw unavailable((error as { name?: string }).name === "TimeoutError" ? "timeout" : "connectivity");
    }
  };

  const getSession = async (): Promise<HowenSession> => {
    if (config.sessionPersistPath) {
      if (!hydrationInFlight) hydrationInFlight = hydrate().finally(() => { hydrationInFlight = undefined; });
      await hydrationInFlight;
    }
    if (
      cached &&
      now() - cached.lastActivityAtMs < config.inactivityThresholdMs
    ) {
      return cached.value;
    }

    cached = undefined;

    if (!loginInFlight) {
      loginInFlight = login().finally(() => {
        loginInFlight = undefined;
      });
    }

    return loginInFlight;
  };

  return {
    getSession,
    recordAuthenticatedActivity(session) {
      if (cached?.value.token === session.token) {
        cached.lastActivityAtMs = now();
      }
    },
    invalidate(session) {
      if (cached?.value.token === session.token) {
        cached = undefined;
        if (config.sessionPersistPath) void unlink(config.sessionPersistPath).catch(() => undefined);
      }
    },
  };
}
