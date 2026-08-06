import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

import { LiveLogoutButton } from "./live-logout-button";

describe("LiveLogoutButton", () => {
  it("revokes the session and returns to login", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    render(<LiveLogoutButton />);

    fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/auth/logout", { method: "POST" }));
    expect(replace).toHaveBeenCalledWith("/login");
  });
});
