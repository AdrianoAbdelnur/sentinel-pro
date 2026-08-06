import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminUserForm } from "./admin-user-form";

describe("AdminUserForm", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));

  it("posts create contracts and shows a returned temporary password once", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ userId: "new", temporaryPassword: "Word-Word-4827" }), { status: 201 }));
    render(<AdminUserForm />);
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Ada" } });
    fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "Lovelace" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Create user" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/admin/users", expect.objectContaining({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ firstName: "Ada", lastName: "Lovelace", email: "ada@example.test", role: "operator" }) })));
    expect(screen.getByText("Word-Word-4827")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss temporary password" }));
    expect(screen.queryByText("Word-Word-4827")).not.toBeInTheDocument();
  });

  it("uses delivery endpoints for reset, deactivate, and role changes", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));
    render(<AdminUserForm />);
    fireEvent.change(screen.getByLabelText("User ID"), { target: { value: "user-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Reset password" }));
    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith("/api/admin/users/user-1/reset", expect.objectContaining({ method: "POST", headers: { "content-type": "application/json" } })));
    fireEvent.click(screen.getByRole("button", { name: "Deactivate membership" }));
    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith("/api/admin/users/user-1/membership", expect.objectContaining({ method: "DELETE", headers: { "content-type": "application/json" } })));
    fireEvent.change(screen.getAllByLabelText("Role")[1], { target: { value: "admin" } });
    fireEvent.click(screen.getByRole("button", { name: "Change role" }));
    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith("/api/admin/users/user-1/membership", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ role: "admin" }) })));
  });

  it("reactivates membership through delivery and reports its result", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));
    render(<AdminUserForm />);
    fireEvent.change(screen.getByLabelText("User ID"), { target: { value: "user-1" } });
    fireEvent.change(screen.getAllByLabelText("Role")[1], { target: { value: "admin" } });
    fireEvent.click(screen.getByRole("button", { name: "Reactivate membership" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/admin/users/user-1/membership", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "active", role: "admin" }) }));
    expect(await screen.findByRole("status")).toHaveTextContent("Membership reactivated.");
  });

  it("shows controlled reactivation loading until the delivery request resolves", async () => {
    let resolve!: (response: Response) => void;
    vi.mocked(fetch).mockReturnValueOnce(new Promise<Response>((done) => { resolve = done; }));
    render(<AdminUserForm />);
    fireEvent.change(screen.getByLabelText("User ID"), { target: { value: "user-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Reactivate membership" }));

    expect(await screen.findByRole("button", { name: "Saving..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reset password" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Deactivate membership" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Change role" })).toBeDisabled();

    resolve(new Response(null, { status: 204 }));
    expect(await screen.findByRole("status")).toHaveTextContent("Membership reactivated.");
    expect(screen.getByRole("button", { name: "Reactivate membership" })).toBeEnabled();
  });

  it("reports a reactivation HTTP error without exposing response secrets", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ error: "Forbidden." }), { status: 403 }));
    render(<AdminUserForm />);
    fireEvent.change(screen.getByLabelText("User ID"), { target: { value: "user-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Reactivate membership" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Forbidden.");
    expect(screen.queryByText(/token|hash/i)).not.toBeInTheDocument();
  });

  it("reports HTTP, non-JSON, and network failures without exposing secrets", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response("The last administrator cannot be changed.", { status: 409 })).mockRejectedValueOnce(new Error("network failed"));
    render(<AdminUserForm />);
    fireEvent.change(screen.getByLabelText("User ID"), { target: { value: "user-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Deactivate membership" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Request failed (409).");
    fireEvent.click(screen.getByRole("button", { name: "Reset password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to complete the request.");
    expect(screen.queryByText(/token|hash/i)).not.toBeInTheDocument();
  });
});
