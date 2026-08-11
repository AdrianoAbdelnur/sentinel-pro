import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requestCatalogApi } = vi.hoisted(() => ({ requestCatalogApi: vi.fn() }));
vi.mock("./catalog-client", () => ({ requestCatalogApi }));

import { ReviewItem } from "./review-item";

const FLEET_REVIEW = { id: "review-1", externalId: "ext-1", subject: "fleet-binding" as const, status: "pending" as const, candidateFleetIds: ["fleet-a", "fleet-b"] };
const VEHICLE_REVIEW = { id: "review-2", externalId: "ext-2", subject: "vehicle-match" as const, status: "pending" as const, candidateVehicleIds: [] };

describe("ReviewItem", () => {
  beforeEach(() => vi.clearAllMocks());

  it("muestra una revisión de vinculación de flota en español, sin la opción de Vehículo nuevo", () => {
    render(<ReviewItem onResolved={vi.fn()} review={FLEET_REVIEW} />);
    expect(screen.getByText("Vinculación de flota — Pendiente")).toBeInTheDocument();
    expect(screen.getByText("Candidatos (IDs): fleet-a, fleet-b")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resolver a Vehículo nuevo" })).not.toBeInTheDocument();
    expect(screen.getByText(/solo pueden resolverse a una Fleet existente/)).toBeInTheDocument();
  });

  it("muestra 'Sin candidatos.' cuando no hay candidatos y ofrece resolver a Vehículo nuevo", () => {
    render(<ReviewItem onResolved={vi.fn()} review={VEHICLE_REVIEW} />);
    expect(screen.getByText("Candidatos (IDs): Sin candidatos.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resolver a Vehículo nuevo" })).toBeInTheDocument();
    expect(screen.queryByText(/solo pueden resolverse a una Fleet existente/)).not.toBeInTheDocument();
  });

  it("respeta el estado deshabilitado, resuelve a un destino existente y reporta un rechazo sin notificar", async () => {
    const onResolved = vi.fn();
    render(<ReviewItem onResolved={onResolved} review={FLEET_REVIEW} />);
    const resolveButton = screen.getByRole("button", { name: "Resolver a existente" });
    expect(resolveButton).toBeDisabled();
    const input = screen.getByLabelText("ID de la Fleet existente");
    fireEvent.change(input, { target: { value: "fleet-a" } });
    expect(resolveButton).toBeEnabled();
    let resolve!: (value: { review: { id: string } }) => void;
    vi.mocked(requestCatalogApi).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    fireEvent.click(resolveButton);
    expect(resolveButton).toBeDisabled();
    resolve({ review: { id: "review-1" } });
    await waitFor(() => expect(onResolved).toHaveBeenCalledWith("review-1"));
    expect(requestCatalogApi).toHaveBeenCalledWith("/api/admin/catalog/reviews/review-1/resolve", { method: "POST", body: JSON.stringify({ targetId: "fleet-a" }) });
    fireEvent.change(input, { target: { value: "fleet-b" } });
    vi.mocked(requestCatalogApi).mockResolvedValueOnce({ error: "Esta revisión ya fue resuelta." });
    fireEvent.click(screen.getByRole("button", { name: "Resolver a existente" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Esta revisión ya fue resuelta.");
    expect(onResolved).toHaveBeenCalledTimes(1);
  });

  it("recorta espacios del ID de destino antes de enviarlo al servidor", async () => {
    const onResolved = vi.fn();
    render(<ReviewItem onResolved={onResolved} review={FLEET_REVIEW} />);
    fireEvent.change(screen.getByLabelText("ID de la Fleet existente"), { target: { value: "  fleet-a  " } });
    vi.mocked(requestCatalogApi).mockResolvedValueOnce({ review: { id: "review-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Resolver a existente" }));
    await waitFor(() => expect(onResolved).toHaveBeenCalledWith("review-1"));
    expect(requestCatalogApi).toHaveBeenCalledWith("/api/admin/catalog/reviews/review-1/resolve", { method: "POST", body: JSON.stringify({ targetId: "fleet-a" }) });
  });

  it("resuelve una coincidencia de vehículo a un Vehículo nuevo y usa la etiqueta de destino correcta", async () => {
    const onResolved = vi.fn();
    render(<ReviewItem onResolved={onResolved} review={VEHICLE_REVIEW} />);
    expect(screen.getByLabelText("ID del Vehículo existente")).toBeInTheDocument();
    let resolve!: (value: { review: { id: string } }) => void;
    vi.mocked(requestCatalogApi).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const newButton = screen.getByRole("button", { name: "Resolver a Vehículo nuevo" });
    fireEvent.click(newButton);
    expect(newButton).toBeDisabled();
    resolve({ review: { id: "review-2" } });
    await waitFor(() => expect(onResolved).toHaveBeenCalledWith("review-2"));
    expect(requestCatalogApi).toHaveBeenCalledWith("/api/admin/catalog/reviews/review-2/resolve", { method: "POST", body: JSON.stringify({ new: true }) });
  });
});
