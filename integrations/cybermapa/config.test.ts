import { describe, expect, it } from "vitest";

import { readCybermapaConfig } from "./config";

describe("readCybermapaConfig", () => {
  it("reads trimmed server configuration with a safe default timeout", () => {
    expect(
      readCybermapaConfig({
        CYBERMAPA_API_URL: " https://cybermapa.example/api/ ",
        CYBERMAPA_USER: " operator ",
        CYBERMAPA_PASSWORD: " raw-secret ",
      }),
    ).toEqual({
      apiUrl: "https://cybermapa.example/api",
      username: "operator",
      password: "raw-secret",
      timeoutMs: 15_000,
    });
  });

  it("rejects incomplete or invalid server configuration", () => {
    expect(() => readCybermapaConfig({})).toThrow("Cybermapa configuration unavailable");
    expect(() =>
      readCybermapaConfig({
        CYBERMAPA_API_URL: "not-a-url",
        CYBERMAPA_USER: "operator",
        CYBERMAPA_PASSWORD: "raw-secret",
      }),
    ).toThrow("Cybermapa configuration unavailable");
  });

  it("accepts a custom bounded timeout and falls back safely otherwise", () => {
    expect(
      readCybermapaConfig({
        CYBERMAPA_API_URL: "https://cybermapa.example/api",
        CYBERMAPA_USER: "operator",
        CYBERMAPA_PASSWORD: "raw-secret",
        CYBERMAPA_TIMEOUT_MS: "5000",
      }).timeoutMs,
    ).toBe(5000);
    expect(
      readCybermapaConfig({
        CYBERMAPA_API_URL: "https://cybermapa.example/api",
        CYBERMAPA_USER: "operator",
        CYBERMAPA_PASSWORD: "raw-secret",
        CYBERMAPA_TIMEOUT_MS: "not-a-number",
      }).timeoutMs,
    ).toBe(15_000);
  });

  it("pins the exact server environment variable names it reads, so a rename cannot silently break startup", () => {
    const complete = {
      CYBERMAPA_API_URL: "https://cybermapa.example/api",
      CYBERMAPA_USER: "operator",
      CYBERMAPA_PASSWORD: "raw-secret",
    };

    expect(() => readCybermapaConfig(complete)).not.toThrow();
    expect(() => readCybermapaConfig({ ...complete, CYBERMAPA_USER: undefined })).toThrow(
      "Cybermapa configuration unavailable",
    );
    expect(() =>
      readCybermapaConfig({ ...complete, CYBERMAPA_USERNAME: "operator", CYBERMAPA_USER: undefined }),
    ).toThrow("Cybermapa configuration unavailable");
  });
});
