import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
import ChangePasswordForm from "./change-password-form";
import OrganizationSelectionForm from "../select-organization/organization-selection-form";

describe("auth delivery forms", () => {
  beforeEach(() => push.mockClear());
  it("submits the mandatory password change", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ next: "/login" }), { status: 200 })));
    render(<ChangePasswordForm />);
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: "eightchars" } });
    fireEvent.click(screen.getByRole("button", { name: /change password/i }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
    expect(fetch).toHaveBeenCalledWith("/api/auth/change-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "eightchars" }),
    });
  });

  it("selects an organization through the route contract", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ next: "/live" }), { status: 200 })));
    render(<OrganizationSelectionForm />);
    fireEvent.change(screen.getByLabelText(/organization id/i), { target: { value: "organization-2" } });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/live"));
    expect(fetch).toHaveBeenCalledWith("/api/auth/select-organization", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ organizationId: "organization-2" }),
    });
  });

  it.each([
    ["invalid password", "/api/auth/change-password", "Change password", "Password must contain at least 8 characters.", 400],
    ["forbidden password change", "/api/auth/change-password", "Change password", "Forbidden.", 403],
    ["forbidden organization selection", "/api/auth/select-organization", "Continue", "Forbidden.", 403],
  ])("shows the %s route error without navigating", async (_name, endpoint, submitLabel, error, status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error }), { status })));
    render(endpoint === "/api/auth/change-password" ? <ChangePasswordForm /> : <OrganizationSelectionForm />);
    if (endpoint === "/api/auth/change-password") {
      fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: "eightchars" } });
    } else {
      fireEvent.change(screen.getByLabelText(/organization id/i), { target: { value: "organization-2" } });
    }
    fireEvent.click(screen.getByRole("button", { name: submitLabel }));
    expect(await screen.findByText(error)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
