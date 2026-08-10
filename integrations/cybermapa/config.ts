const DEFAULT_TIMEOUT_MS = 15_000;

export type CybermapaConfig = {
  apiUrl: string;
  username: string;
  password: string;
  timeoutMs: number;
};

type CybermapaEnvironment = Record<string, string | undefined>;

function required(environment: CybermapaEnvironment, name: string): string {
  const value = environment[name]?.trim();

  if (!value) {
    throw new Error("Cybermapa configuration unavailable");
  }

  return value;
}

function apiUrl(environment: CybermapaEnvironment): string {
  const candidate = required(environment, "CYBERMAPA_API_URL").replace(/\/+$/, "");

  try {
    const parsed = new URL(candidate);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error();
    }

    return candidate;
  } catch {
    throw new Error("Cybermapa configuration unavailable");
  }
}

function timeout(environment: CybermapaEnvironment): number {
  const raw = environment.CYBERMAPA_TIMEOUT_MS?.trim();

  if (!raw) {
    return DEFAULT_TIMEOUT_MS;
  }

  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_TIMEOUT_MS;
}

export function readCybermapaConfig(
  environment: CybermapaEnvironment = process.env,
): CybermapaConfig {
  return {
    apiUrl: apiUrl(environment),
    username: required(environment, "CYBERMAPA_USER"),
    password: required(environment, "CYBERMAPA_PASSWORD"),
    timeoutMs: timeout(environment),
  };
}
