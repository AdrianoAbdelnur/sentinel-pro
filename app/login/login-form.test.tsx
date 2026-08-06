import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
import LoginForm from "./login-form";

describe("LoginForm", () => {
  beforeEach(() => push.mockClear());
  it("submits credentials and follows the delivery next contract", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ next: "/select-organization" }), { status: 200 })));
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "user@example.test" } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: "password" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/select-organization"));
    expect(fetch).toHaveBeenCalledWith("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "user@example.test", password: "password" }),
    });
  });

  it("shows the route error without exposing identity details", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Invalid email or password." }), { status: 401 })));
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "user@example.test" } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByText("Invalid email or password.")).toBeInTheDocument();
  });

  it("shows the no-active-membership error without navigating", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "No active organization membership." }), { status: 403 })));
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "user@example.test" } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: "password" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByText("No active organization membership.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
