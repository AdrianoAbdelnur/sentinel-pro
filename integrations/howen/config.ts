export const HOWEN_INACTIVITY_THRESHOLD_MS = 25 * 60 * 1000;

const DEFAULT_TIMEOUT_MS = 15_000;

export type HowenConfig = {
  baseUrl: string;
  username: string;
  password: string;
  timeoutMs: number;
  inactivityThresholdMs: number;
};

type HowenEnvironment = Record<string, string | undefined>;

function required(
  environment: HowenEnvironment,
  name: string,
): string {
  const value = environment[name]?.trim();

  if (!value) {
    throw new Error("Howen configuration unavailable");
  }

  return value;
}

function baseUrl(environment: HowenEnvironment): string {
  const candidate = required(environment, "HOWEN_BASE_URL").replace(/\/+$/, "");

  try {
    const parsed = new URL(candidate);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error();
    }

    return candidate;
  } catch {
    throw new Error("Howen configuration unavailable");
  }
}

function timeout(environment: HowenEnvironment): number {
  const raw = environment.HOWEN_TIMEOUT_MS?.trim();

  if (!raw) {
    return DEFAULT_TIMEOUT_MS;
  }

  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_TIMEOUT_MS;
}

export function readHowenConfig(
  environment: HowenEnvironment = process.env,
): HowenConfig {
  return {
    baseUrl: baseUrl(environment),
    username: required(environment, "HOWEN_USERNAME"),
    password: required(environment, "HOWEN_PASSWORD"),
    timeoutMs: timeout(environment),
    inactivityThresholdMs: HOWEN_INACTIVITY_THRESHOLD_MS,
  };
}
