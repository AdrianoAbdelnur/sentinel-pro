import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminUserForm } from "./admin-user-form";

describe("AdminUserForm", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));

  it("posts create contracts and shows a returned temporary password once", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ userId: "new", temporaryPassword: "Word-Word-4827" }), { status: 201 }));
    render(<AdminUserForm />);
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Ada" } });
    fireEvent.change(screen.getByLabelText("Apellido"), { target: { value: "Lovelace" } });
    fireEvent.change(screen.getByLabelText("Correo electrónico"), { target: { value: "ada@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear usuario" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/admin/users", expect.objectContaining({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ firstName: "Ada", lastName: "Lovelace", email: "ada@example.test", role: "operator" }) })));
    expect(screen.getByText("Word-Word-4827")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ocultar contraseña temporal" }));
    expect(screen.queryByText("Word-Word-4827")).not.toBeInTheDocument();
  });

  it("uses delivery endpoints for reset, deactivate, and role changes", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));
    render(<AdminUserForm />);
    fireEvent.change(screen.getByLabelText("ID de usuario"), { target: { value: "user-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Restablecer contraseña" }));
    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith("/api/admin/users/user-1/reset", expect.objectContaining({ method: "POST", headers: { "content-type": "application/json" } })));
    fireEvent.click(screen.getByRole("button", { name: "Desactivar membresía" }));
    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith("/api/admin/users/user-1/membership", expect.objectContaining({ method: "DELETE", headers: { "content-type": "application/json" } })));
    fireEvent.change(screen.getAllByLabelText("Rol")[1], { target: { value: "admin" } });
    fireEvent.click(screen.getByRole("button", { name: "Cambiar rol" }));
    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith("/api/admin/users/user-1/membership", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ role: "admin" }) })));
  });

  it("reactivates membership through delivery and reports its result", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));
    render(<AdminUserForm />);
    fireEvent.change(screen.getByLabelText("ID de usuario"), { target: { value: "user-1" } });
    fireEvent.change(screen.getAllByLabelText("Rol")[1], { target: { value: "admin" } });
    fireEvent.click(screen.getByRole("button", { name: "Reactivar membresía" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/admin/users/user-1/membership", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "active", role: "admin" }) }));
    expect(await screen.findByRole("status")).toHaveTextContent("Membresía reactivada.");
  });

  it("shows controlled reactivation loading until the delivery request resolves", async () => {
    let resolve!: (response: Response) => void;
    vi.mocked(fetch).mockReturnValueOnce(new Promise<Response>((done) => { resolve = done; }));
    render(<AdminUserForm />);
    fireEvent.change(screen.getByLabelText("ID de usuario"), { target: { value: "user-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Reactivar membresía" }));

    expect(await screen.findByRole("button", { name: "Guardando..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Restablecer contraseña" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Desactivar membresía" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cambiar rol" })).toBeDisabled();

    resolve(new Response(null, { status: 204 }));
    expect(await screen.findByRole("status")).toHaveTextContent("Membresía reactivada.");
    expect(screen.getByRole("button", { name: "Reactivar membresía" })).toBeEnabled();
  });

  it("reports a reactivation HTTP error without exposing response secrets", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ error: "No tenés permisos para realizar esta acción." }), { status: 403 }));
    render(<AdminUserForm />);
    fireEvent.change(screen.getByLabelText("ID de usuario"), { target: { value: "user-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Reactivar membresía" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No tenés permisos para realizar esta acción.");
    expect(screen.queryByText(/token|hash/i)).not.toBeInTheDocument();
  });

  it("reports HTTP, non-JSON, and network failures without exposing secrets", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response("The last administrator cannot be changed.", { status: 409 })).mockRejectedValueOnce(new Error("network failed"));
    render(<AdminUserForm />);
    fireEvent.change(screen.getByLabelText("ID de usuario"), { target: { value: "user-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Desactivar membresía" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("La solicitud falló (409).");
    fireEvent.click(screen.getByRole("button", { name: "Restablecer contraseña" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos completar la solicitud.");
    expect(screen.queryByText(/token|hash/i)).not.toBeInTheDocument();
  });
});
