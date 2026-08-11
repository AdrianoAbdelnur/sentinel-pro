import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requestCatalogApi } = vi.hoisted(() => ({ requestCatalogApi: vi.fn() }));
vi.mock("./catalog-client", () => ({ requestCatalogApi }));

import { PendingReviewsPanel } from "./pending-reviews-panel";

const FLEET_REVIEW = { id: "review-1", externalId: "ext-1", subject: "fleet-binding" as const, status: "pending" as const, candidateFleetIds: ["fleet-a"] };
const VEHICLE_REVIEW = { id: "review-2", externalId: "ext-2", subject: "vehicle-match" as const, status: "pending" as const, candidateVehicleIds: ["veh-a"] };

describe("PendingReviewsPanel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("carga y muestra revisiones pendientes, o su ausencia, en español", async () => {
    vi.mocked(requestCatalogApi).mockResolvedValueOnce({ reviews: [FLEET_REVIEW, VEHICLE_REVIEW] });
    render(<PendingReviewsPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Cargar revisiones pendientes" }));
    expect(await screen.findByText("Vinculación de flota — Pendiente")).toBeInTheDocument();
    expect(screen.getByText("Coincidencia de vehículo — Pendiente")).toBeInTheDocument();
    vi.mocked(requestCatalogApi).mockResolvedValueOnce({ reviews: [] });
    fireEvent.click(screen.getByRole("button", { name: "Cargar revisiones pendientes" }));
    expect(await screen.findByText("No hay revisiones pendientes.")).toBeInTheDocument();
    expect(screen.queryByText("Vinculación de flota — Pendiente")).not.toBeInTheDocument();
  });

  it("informa un error de carga y deshabilita el botón mientras la solicitud está en curso", async () => {
    let resolve!: (value: { reviews: (typeof FLEET_REVIEW)[] }) => void;
    vi.mocked(requestCatalogApi).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    render(<PendingReviewsPanel />);
    const loadButton = screen.getByRole("button", { name: "Cargar revisiones pendientes" });
    fireEvent.click(loadButton);
    expect(loadButton).toBeDisabled();
    resolve({ reviews: [] });
    await waitFor(() => expect(loadButton).toBeEnabled());
    vi.mocked(requestCatalogApi).mockResolvedValueOnce({ error: "No tenés permisos para realizar esta acción." });
    fireEvent.click(loadButton);
    expect(await screen.findByRole("alert")).toHaveTextContent("No tenés permisos para realizar esta acción.");
  });

  it("quita de la lista la revisión resuelta, conserva las demás y anuncia el resultado", async () => {
    vi.mocked(requestCatalogApi).mockResolvedValueOnce({ reviews: [FLEET_REVIEW, VEHICLE_REVIEW] });
    render(<PendingReviewsPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Cargar revisiones pendientes" }));
    const fleetItem = (await screen.findByText("Vinculación de flota — Pendiente")).closest("li")!;
    fireEvent.change(within(fleetItem).getByLabelText("ID de la Fleet existente"), { target: { value: "fleet-a" } });
    vi.mocked(requestCatalogApi).mockResolvedValueOnce({ review: { id: "review-1" } });
    fireEvent.click(within(fleetItem).getByRole("button", { name: "Resolver a existente" }));
    await waitFor(() => expect(screen.queryByText("Vinculación de flota — Pendiente")).not.toBeInTheDocument());
    expect(screen.getByText("Coincidencia de vehículo — Pendiente")).toBeInTheDocument();
    expect(await screen.findByRole("status")).toHaveTextContent("Revisión resuelta.");
  });
});
