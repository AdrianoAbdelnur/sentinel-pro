import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requirePageAuthorization } = vi.hoisted(() => ({ requirePageAuthorization: vi.fn() }));
vi.mock("@/app/require-page-authorization", () => ({ requirePageAuthorization }));
vi.mock("@/app/admin/catalog/pending-reviews-panel", () => ({ PendingReviewsPanel: ({ autoLoad }: { autoLoad?: boolean }) => <div data-auto-load={String(autoLoad)}>reviews</div> }));

import CatalogReviewPage from "./page";

describe("CatalogReviewPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires an administrator and enables automatic review loading", async () => {
    requirePageAuthorization.mockResolvedValue({ userId: "admin", organizationId: "org", role: "admin" });
    render(await CatalogReviewPage());
    expect(requirePageAuthorization).toHaveBeenCalledWith("admin");
    expect(screen.getByText("reviews")).toHaveAttribute("data-auto-load", "true");
  });
});
