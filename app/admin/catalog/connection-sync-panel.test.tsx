import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requestCatalogApi } = vi.hoisted(() => ({ requestCatalogApi: vi.fn() }));
vi.mock("./catalog-client", () => ({ requestCatalogApi }));

import { ConnectionSyncPanel } from "./connection-sync-panel";

const COUNTS = { processed: 5, created: 2, linked: 1, reviewed: 1, rejected: 0, absent: 1 };
const FULL_STATUS = { connectionId: "conn-1", latestRun: { status: "succeeded", trigger: "manual", startedAt: "2026-08-09T10:00:00.000Z", completedAt: "2026-08-09T10:05:00.000Z", counts: COUNTS }, lastSuccessAt: "2026-08-09T10:05:00.000Z", isDue: false };

async function fillConnectionId(value = "conn-1") {
  fireEvent.change(screen.getByLabelText("ID de conexión"), { target: { value } });
}

describe("ConnectionSyncPanel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("consulta el estado, muestra los datos en español y distingue la frescura", async () => {
    vi.mocked(requestCatalogApi).mockResolvedValueOnce({ status: FULL_STATUS });
    render(<ConnectionSyncPanel />);
    await fillConnectionId();
    fireEvent.click(screen.getByRole("button", { name: "Consultar estado" }));
    expect(await screen.findByRole("region", { name: "Estado de la conexión" })).toBeInTheDocument();
    expect(requestCatalogApi).toHaveBeenCalledWith("/api/admin/catalog/connections/conn-1/status", { method: "GET" });
    expect(screen.getByText("Estado: Exitosa")).toBeInTheDocument();
    expect(screen.getByText("Disparador: Manual")).toBeInTheDocument();
    expect(screen.getByText("Procesados: 5")).toBeInTheDocument();
    expect(screen.getByText("Ausentes: 1")).toBeInTheDocument();
    expect(screen.getByText("Sincronización al día.")).toBeInTheDocument();
    expect(screen.queryByText("Sincronización pendiente.")).not.toBeInTheDocument();
    vi.mocked(requestCatalogApi).mockResolvedValueOnce({ status: { ...FULL_STATUS, isDue: true } });
    fireEvent.click(screen.getByRole("button", { name: "Consultar estado" }));
    expect(await screen.findByText("Sincronización pendiente.")).toBeInTheDocument();
    expect(screen.queryByText("Sincronización al día.")).not.toBeInTheDocument();
  });

  it("muestra el resumen de una falla sanitizado y traducido al español", async () => {
    vi.mocked(requestCatalogApi).mockResolvedValueOnce({ status: { connectionId: "conn-1", latestRun: { status: "failed", trigger: "scheduler", startedAt: "2026-08-09T10:00:00.000Z", completedAt: "2026-08-09T10:01:00.000Z", counts: { processed: 0, created: 0, linked: 0, reviewed: 0, rejected: 0, absent: 0 }, failure: { category: "authentication", httpStatus: 401 } }, isDue: true } });
    render(<ConnectionSyncPanel />);
    await fillConnectionId();
    fireEvent.click(screen.getByRole("button", { name: "Consultar estado" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Falló la autenticación - HTTP 401");
    expect(screen.queryByText(/Authentication failed/)).not.toBeInTheDocument();
  });

  it("distingue una sincronización exitosa de una omitida por estar fresca", async () => {
    render(<ConnectionSyncPanel />);
    await fillConnectionId();
    vi.mocked(requestCatalogApi).mockResolvedValueOnce({ status: "succeeded", counts: COUNTS }).mockResolvedValueOnce({ status: FULL_STATUS });
    fireEvent.click(screen.getByRole("button", { name: "Sincronizar ahora" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Sincronización completada.");
    vi.mocked(requestCatalogApi).mockResolvedValueOnce({ status: "skipped-fresh" }).mockResolvedValueOnce({ status: FULL_STATUS });
    fireEvent.click(screen.getByRole("button", { name: "Sincronizar ahora" }));
    expect(await screen.findByRole("status")).toHaveTextContent("La conexión ya estaba sincronizada.");
  });

  it("sincroniza correctamente aunque la actualización de estado posterior falle, sin dejar un estado desactualizado", async () => {
    vi.mocked(requestCatalogApi).mockResolvedValueOnce({ status: FULL_STATUS });
    render(<ConnectionSyncPanel />);
    await fillConnectionId();
    fireEvent.click(screen.getByRole("button", { name: "Consultar estado" }));
    await screen.findByText("Conexión: conn-1");
    vi.mocked(requestCatalogApi).mockResolvedValueOnce({ status: "succeeded", counts: COUNTS }).mockResolvedValueOnce({ error: "No pudimos completar la solicitud." });
    fireEvent.click(screen.getByRole("button", { name: "Sincronizar ahora" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Sincronización completada.");
    await waitFor(() => expect(screen.queryByText("Conexión: conn-1")).not.toBeInTheDocument());
  });

  it("muestra los tres resultados distinguibles de un intento de sincronización fallido", async () => {
    render(<ConnectionSyncPanel />);
    await fillConnectionId();
    vi.mocked(requestCatalogApi).mockResolvedValueOnce({ error: "Este proveedor todavía no admite sincronización." });
    fireEvent.click(screen.getByRole("button", { name: "Sincronizar ahora" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Este proveedor todavía no admite sincronización.");
    vi.mocked(requestCatalogApi).mockResolvedValueOnce({ error: "Esta conexión no tiene una Company asignada. Asigná una Company para poder sincronizar." });
    fireEvent.click(screen.getByRole("button", { name: "Sincronizar ahora" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Esta conexión no tiene una Company asignada. Asigná una Company para poder sincronizar.");
    vi.mocked(requestCatalogApi).mockResolvedValueOnce({ error: "La conexión con el proveedor está mal configurada. Contactá al equipo técnico." });
    fireEvent.click(screen.getByRole("button", { name: "Sincronizar ahora" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("La conexión con el proveedor está mal configurada. Contactá al equipo técnico.");
  });

  it("asigna una Company a la conexión y reporta un rechazo del servidor", async () => {
    render(<ConnectionSyncPanel />);
    await fillConnectionId();
    fireEvent.change(screen.getByLabelText("ID de Company"), { target: { value: "company-1" } });
    vi.mocked(requestCatalogApi).mockResolvedValueOnce({ connection: { id: "conn-1", companyId: "company-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Asignar Company a la conexión" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Company asignada a la conexión.");
    expect(requestCatalogApi).toHaveBeenCalledWith("/api/admin/catalog/connections/conn-1/company", { method: "POST", body: JSON.stringify({ companyId: "company-1" }) });
    vi.mocked(requestCatalogApi).mockResolvedValueOnce({ error: "No tenés permisos para realizar esta acción." });
    fireEvent.click(screen.getByRole("button", { name: "Asignar Company a la conexión" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No tenés permisos para realizar esta acción.");
  });

  it("muestra que la conexión nunca sincronizó cuando no hay corridas registradas", async () => {
    vi.mocked(requestCatalogApi).mockResolvedValueOnce({ status: { connectionId: "conn-1", isDue: true } });
    render(<ConnectionSyncPanel />);
    await fillConnectionId();
    fireEvent.click(screen.getByRole("button", { name: "Consultar estado" }));
    expect(await screen.findByText("Todavía no hay sincronizaciones registradas.")).toBeInTheDocument();
  });

  it("limpia el estado anterior cuando la conexión cambia y la nueva solicitud falla, mostrando a qué conexión pertenece", async () => {
    vi.mocked(requestCatalogApi).mockResolvedValueOnce({ status: FULL_STATUS });
    render(<ConnectionSyncPanel />);
    await fillConnectionId("conn-1");
    fireEvent.click(screen.getByRole("button", { name: "Consultar estado" }));
    expect(await screen.findByText("Conexión: conn-1")).toBeInTheDocument();
    await fillConnectionId("conn-2");
    vi.mocked(requestCatalogApi).mockResolvedValueOnce({ error: "No tenés permisos para realizar esta acción." });
    fireEvent.click(screen.getByRole("button", { name: "Consultar estado" }));
    await screen.findByRole("alert");
    expect(screen.queryByText("Conexión: conn-1")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Estado de la conexión" })).not.toBeInTheDocument();
    vi.mocked(requestCatalogApi).mockResolvedValueOnce({ status: FULL_STATUS });
    fireEvent.click(screen.getByRole("button", { name: "Consultar estado" }));
    await screen.findByText("Conexión: conn-1");
    await fillConnectionId("conn-3");
    vi.mocked(requestCatalogApi).mockResolvedValueOnce({ error: "Este proveedor todavía no admite sincronización." });
    fireEvent.click(screen.getByRole("button", { name: "Sincronizar ahora" }));
    await screen.findByRole("alert");
    expect(screen.queryByText("Conexión: conn-1")).not.toBeInTheDocument();
  });

  it("deshabilita los controles mientras una solicitud está en curso y los rehabilita al terminar", async () => {
    let resolve!: (value: { status: typeof FULL_STATUS }) => void;
    vi.mocked(requestCatalogApi).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    render(<ConnectionSyncPanel />);
    await fillConnectionId();
    fireEvent.change(screen.getByLabelText("ID de Company"), { target: { value: "company-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Consultar estado" }));
    expect(screen.getByRole("button", { name: "Consultar estado" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Sincronizar ahora" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Asignar Company a la conexión" })).toBeDisabled();
    resolve({ status: FULL_STATUS });
    await waitFor(() => expect(screen.getByRole("button", { name: "Consultar estado" })).toBeEnabled());
    expect(screen.getByRole("button", { name: "Sincronizar ahora" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Asignar Company a la conexión" })).toBeEnabled();
  });
});
