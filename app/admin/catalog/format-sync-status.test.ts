import { describe, expect, it } from "vitest";

import { formatSyncDateTime, translateSyncFailureSummary } from "./format-sync-status";

describe("formatSyncDateTime", () => {
  it("formats an ISO timestamp using the Argentina locale and reports absence in Spanish", () => {
    expect(formatSyncDateTime("2026-08-09T12:00:00.000Z")).toMatch(/2026/);
    expect(formatSyncDateTime(undefined)).toBe("Sin registros");
  });
});

describe("translateSyncFailureSummary", () => {
  it("translates known categories and codes into Spanish, with a safe Spanish fallback", () => {
    expect(translateSyncFailureSummary(undefined)).toBeUndefined();
    expect(translateSyncFailureSummary("Authentication failed - HTTP 401")).toBe("Falló la autenticación - HTTP 401");
    expect(translateSyncFailureSummary("Internal synchronization error - code TIMEOUT_X")).toBe("Error interno de sincronización - código TIMEOUT_X");
    expect(translateSyncFailureSummary("Some new english failure")).toBe("Ocurrió un error durante la sincronización.");
  });
});
