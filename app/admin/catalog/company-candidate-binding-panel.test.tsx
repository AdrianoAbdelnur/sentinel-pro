import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requestCatalogApi } = vi.hoisted(() => ({ requestCatalogApi: vi.fn() }));
vi.mock("./catalog-client", () => ({ requestCatalogApi }));

import { CompanyCandidateBindingPanel } from "./company-candidate-binding-panel";

describe("CompanyCandidateBindingPanel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("vincula un candidato a una Company y reporta un rechazo del servidor sin exponer detalles técnicos", async () => {
    render(<CompanyCandidateBindingPanel />);
    fireEvent.change(screen.getByLabelText("ID del candidato"), { target: { value: "cand-1" } });
    fireEvent.change(screen.getByLabelText("ID de Company"), { target: { value: "company-1" } });
    vi.mocked(requestCatalogApi).mockResolvedValueOnce({ candidate: { id: "cand-1", companyId: "company-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Vincular candidato a la Company" }));
    expect(requestCatalogApi).toHaveBeenCalledWith("/api/admin/catalog/companies/candidates/cand-1/bind", { method: "POST", body: JSON.stringify({ companyId: "company-1" }) });
    expect(await screen.findByRole("status")).toHaveTextContent("Candidato vinculado a la Company.");
    vi.mocked(requestCatalogApi).mockResolvedValueOnce({ error: "No tenés permisos para realizar esta acción." });
    fireEvent.click(screen.getByRole("button", { name: "Vincular candidato a la Company" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No tenés permisos para realizar esta acción.");
    expect(screen.queryByText(/token|hash/i)).not.toBeInTheDocument();
  });

  it("recorta espacios de ambos IDs antes de enviarlos al servidor", async () => {
    render(<CompanyCandidateBindingPanel />);
    fireEvent.change(screen.getByLabelText("ID del candidato"), { target: { value: "  cand-1  " } });
    fireEvent.change(screen.getByLabelText("ID de Company"), { target: { value: "  company-1  " } });
    vi.mocked(requestCatalogApi).mockResolvedValueOnce({ candidate: { id: "cand-1", companyId: "company-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Vincular candidato a la Company" }));
    expect(requestCatalogApi).toHaveBeenCalledWith("/api/admin/catalog/companies/candidates/cand-1/bind", { method: "POST", body: JSON.stringify({ companyId: "company-1" }) });
  });

  it("mantiene el botón deshabilitado hasta completar ambos campos", () => {
    render(<CompanyCandidateBindingPanel />);
    expect(screen.getByRole("button", { name: "Vincular candidato a la Company" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("ID del candidato"), { target: { value: "cand-1" } });
    expect(screen.getByRole("button", { name: "Vincular candidato a la Company" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("ID de Company"), { target: { value: "company-1" } });
    expect(screen.getByRole("button", { name: "Vincular candidato a la Company" })).toBeEnabled();
  });
});
