import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
vi.mock("./require-page-authorization", () => ({ requirePageAuthorization: vi.fn().mockResolvedValue({ userId: "u", organizationId: "o", role: "operator" }) }));
import Home from "./page";
describe("Home page", () => { it("shows the project foundation message after operator authorization", async () => { render(await Home()); expect(screen.getByRole("heading", { name: /base inicial lista para gentle ai, sdd y tdd/i })).toBeInTheDocument(); expect(screen.getByText(/openspec inicializado para cambios guiados por sdd/i)).toBeInTheDocument(); }); });
