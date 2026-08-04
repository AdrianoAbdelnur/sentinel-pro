import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_STALE_AFTER_MS } from "@/domain/live";

import { readLiveRuntimeConfig } from "./live-runtime-config";

const ENV_VAR = "SENTINEL_LIVE_STALE_AFTER_MS";

describe("readLiveRuntimeConfig", () => {
  const originalValue = process.env[ENV_VAR];

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env[ENV_VAR];
    } else {
      process.env[ENV_VAR] = originalValue;
    }
    vi.restoreAllMocks();
  });

  it("returns the domain default staleness threshold when the env var is unset", () => {
    delete process.env[ENV_VAR];

    expect(readLiveRuntimeConfig({ NODE_ENV: "production" })).toEqual({
      staleAfterMs: DEFAULT_STALE_AFTER_MS,
      includeDevelopmentFixtures: false,
    });
  });

  it("does not warn when the env var is simply unset", () => {
    delete process.env[ENV_VAR];
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    readLiveRuntimeConfig({ NODE_ENV: "production" });

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("returns the parsed value in milliseconds from a valid override", () => {
    process.env[ENV_VAR] = "600000";

    expect(
      readLiveRuntimeConfig({
        NODE_ENV: "production",
        [ENV_VAR]: "600000",
      }),
    ).toEqual({
      staleAfterMs: 600_000,
      includeDevelopmentFixtures: false,
    });
  });

  it.each([
    ["non-numeric", "not-a-number"],
    ["negative", "-1000"],
    ["zero", "0"],
    ["empty string", ""],
  ])(
    "falls back to the default and warns once when the value is %s",
    (_label, rawValue) => {
      process.env[ENV_VAR] = rawValue;
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      expect(
        readLiveRuntimeConfig({
          NODE_ENV: "production",
          [ENV_VAR]: rawValue,
        }),
      ).toEqual({
        staleAfterMs: DEFAULT_STALE_AFTER_MS,
        includeDevelopmentFixtures: false,
      });
      expect(warnSpy).toHaveBeenCalledTimes(1);
    },
  );

  it("returns the identical result for identical env state (no hidden state)", () => {
    process.env[ENV_VAR] = "120000";

    expect(readLiveRuntimeConfig()).toEqual(readLiveRuntimeConfig());
  });

  it("includes development fixtures only for the local development runtime", () => {
    expect(
      readLiveRuntimeConfig({ NODE_ENV: "development" })
        .includeDevelopmentFixtures,
    ).toBe(true);
    expect(
      readLiveRuntimeConfig({ NODE_ENV: "production" })
        .includeDevelopmentFixtures,
    ).toBe(false);
    expect(
      readLiveRuntimeConfig({ NODE_ENV: "test" }).includeDevelopmentFixtures,
    ).toBe(false);
  });
});
