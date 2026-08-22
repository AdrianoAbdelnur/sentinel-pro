import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requestCatalogApi } = vi.hoisted(() => ({ requestCatalogApi: vi.fn() }));
vi.mock("./catalog-client", () => ({ requestCatalogApi }));

import { PendingReviewsPanel } from "./pending-reviews-panel";

const review = (id: string) => ({ id, externalId: `external-${id}`, subject: "vehicle-identity" as const, reason: "ambiguous-match" as const, status: "pending" as const, candidateVehicleIds: [`vehicle-${id}`] });

describe("PendingReviewsPanel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads canonical reviews and shows the empty state", async () => {
    vi.mocked(requestCatalogApi).mockResolvedValueOnce({ reviews: [review("1"), review("2")] });
    render(<PendingReviewsPanel />);
    const button = screen.getByRole("button", { name: "Cargar revisiones pendientes" });
    fireEvent.click(button);
    expect(await screen.findAllByText("Identidad de vehículo — Pendiente")).toHaveLength(2);

    vi.mocked(requestCatalogApi).mockResolvedValueOnce({ reviews: [] });
    fireEvent.click(button);
    expect(await screen.findByText("No hay revisiones pendientes.")).toBeInTheDocument();
  });

  it("removes only the resolved review", async () => {
    vi.mocked(requestCatalogApi).mockResolvedValueOnce({ reviews: [review("1"), review("2")] });
    render(<PendingReviewsPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Cargar revisiones pendientes" }));
    const item = (await screen.findByText("Externo: external-1")).closest("li")!;
    fireEvent.change(within(item).getByLabelText("ID del vehículo existente"), { target: { value: "vehicle-1" } });
    vi.mocked(requestCatalogApi).mockResolvedValueOnce({ review: { id: "1" } });
    fireEvent.click(within(item).getByRole("button", { name: "Resolver a vehículo" }));

    await waitFor(() => expect(screen.queryByText("Externo: external-1")).not.toBeInTheDocument());
    expect(screen.getByText("Externo: external-2")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Revisión resuelta.");
  });
});
