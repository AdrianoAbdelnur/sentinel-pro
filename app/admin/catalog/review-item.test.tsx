import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requestCatalogApi } = vi.hoisted(() => ({ requestCatalogApi: vi.fn() }));
vi.mock("./catalog-client", () => ({ requestCatalogApi }));

import { ReviewItem } from "./review-item";

const REVIEW = {
  id: "review-1",
  externalId: "external-1",
  subject: "vehicle-identity" as const,
  reason: "ambiguous-match" as const,
  status: "pending" as const,
  candidateVehicleIds: ["vehicle-1", "vehicle-2"],
};

describe("ReviewItem", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows canonical vehicle candidates without creation or fleet actions", () => {
    render(<ReviewItem onResolved={vi.fn()} review={REVIEW} />);

    expect(screen.getByText("Identidad de vehículo — Pendiente")).toBeInTheDocument();
    expect(screen.getByText("Candidatos (IDs): vehicle-1, vehicle-2")).toBeInTheDocument();
    expect(screen.getByLabelText("ID del vehículo existente")).toBeInTheDocument();
    expect(screen.queryByText(/Company|Fleet|nuevo/i)).not.toBeInTheDocument();
  });

  it("resolves to an existing canonical vehicle and reports server rejection", async () => {
    const onResolved = vi.fn();
    render(<ReviewItem onResolved={onResolved} review={REVIEW} />);
    const input = screen.getByLabelText("ID del vehículo existente");
    const button = screen.getByRole("button", { name: "Resolver a vehículo" });
    expect(button).toBeDisabled();

    fireEvent.change(input, { target: { value: "  vehicle-1  " } });
    vi.mocked(requestCatalogApi).mockResolvedValueOnce({ review: { id: "review-1" } });
    fireEvent.click(button);

    await waitFor(() => expect(onResolved).toHaveBeenCalledWith("review-1"));
    expect(requestCatalogApi).toHaveBeenCalledWith("/api/admin/catalog/reviews/review-1/resolve", { method: "POST", body: JSON.stringify({ targetId: "vehicle-1" }) });

    fireEvent.change(input, { target: { value: "vehicle-2" } });
    vi.mocked(requestCatalogApi).mockResolvedValueOnce({ error: "Esta revisión ya fue resuelta." });
    fireEvent.click(button);
    expect(await screen.findByRole("alert")).toHaveTextContent("Esta revisión ya fue resuelta.");
    expect(onResolved).toHaveBeenCalledTimes(1);
  });
});
