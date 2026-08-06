import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
import LoginForm from "./login-form";

describe("LoginForm", () => {
  beforeEach(() => push.mockClear());

  it("renders the login controls in Spanish", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText("Correo electrónico")).toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ingresar" })).toBeInTheDocument();
  });

  it("submits credentials and follows the delivery next contract", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ next: "/select-organization" }), { status: 200 })));
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("Correo electrónico"), { target: { value: "user@example.test" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "password" } });
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/select-organization"));
    expect(fetch).toHaveBeenCalledWith("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "user@example.test", password: "password" }),
    });
  });

  it("shows the route error without exposing identity details", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "El correo electrónico o la contraseña no son válidos." }), { status: 401 })));
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("Correo electrónico"), { target: { value: "user@example.test" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));
    expect(await screen.findByText("El correo electrónico o la contraseña no son válidos.")).toBeInTheDocument();
  });

  it("shows a generic error when the endpoint returns an empty error response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("Correo electrónico"), { target: { value: "user@example.test" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "password" } });
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));
    expect(await screen.findByText("No pudimos continuar. Intentá nuevamente.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("shows the no-active-membership error without navigating", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "No tenés una membresía activa en una organización." }), { status: 403 })));
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("Correo electrónico"), { target: { value: "user@example.test" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "password" } });
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));
    expect(await screen.findByText("No tenés una membresía activa en una organización.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
