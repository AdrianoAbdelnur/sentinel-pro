import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getPageAuthorization, redirect } = vi.hoisted(() => ({
  getPageAuthorization: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/app/authorization", () => ({ getPageAuthorization }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("./login-form", () => ({ default: () => <div>login form</div> }));

import LoginPage from "./page";

describe("LoginPage", () => {
  beforeEach(() => {
    getPageAuthorization.mockReset();
    redirect.mockReset();
  });

  it("redirects an authenticated visitor to the home page", async () => {
    getPageAuthorization.mockResolvedValue({ kind: "authorized", context: { userId: "user-1", organizationId: "org-1", role: "operator" } });

    await LoginPage();

    expect(getPageAuthorization).toHaveBeenCalledWith("operator");
    expect(redirect).toHaveBeenCalledWith("/");
  });

  it("renders the login form for an unauthenticated visitor", async () => {
    getPageAuthorization.mockResolvedValue({ kind: "forbidden" });

    render(await LoginPage());

    expect(screen.getByText("login form")).toBeInTheDocument();
    expect(redirect).not.toHaveBeenCalled();
  });
});
