import { beforeEach, describe, expect, it, vi } from "vitest";

const { requirePageAuthorization } = vi.hoisted(() => ({ requirePageAuthorization: vi.fn() }));
vi.mock("@/app/require-page-authorization", () => ({ requirePageAuthorization }));
import CatalogAdminPage from "./page";

describe("CatalogAdminPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders only after fresh administrator authorization", async () => {
    requirePageAuthorization.mockResolvedValue({ userId: "admin", organizationId: "org", role: "admin" });
    await CatalogAdminPage();
    expect(requirePageAuthorization).toHaveBeenCalledWith("admin");
  });

  it("does not render for an operator authorization result", async () => {
    requirePageAuthorization.mockRejectedValueOnce(new Error("operator authorization denied"));
    await expect(CatalogAdminPage()).rejects.toThrow("operator authorization denied");
    expect(requirePageAuthorization).toHaveBeenCalledWith("admin");
  });

  it("does not render for a revoked or invalid session authorization result", async () => {
    requirePageAuthorization.mockRejectedValueOnce(new Error("revoked session authorization denied"));
    await expect(CatalogAdminPage()).rejects.toThrow("revoked session authorization denied");
    expect(requirePageAuthorization).toHaveBeenCalledWith("admin");
  });
});
