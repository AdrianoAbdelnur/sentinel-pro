import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const requirePageAuthorization = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ userId: "u", organizationId: "o", role: "operator" }),
);

vi.mock("@/app/require-page-authorization", () => ({ requirePageAuthorization }));

vi.mock("./driving-index-screen", () => ({
  DrivingIndexScreen: () => <div data-testid="driving-index-screen-stub" />,
}));

import DrivingIndexPage from "./page";

describe("DrivingIndexPage", () => {
  it("requires the operator role before rendering the screen", async () => {
    render(await DrivingIndexPage());

    expect(requirePageAuthorization).toHaveBeenCalledWith("operator");
    expect(screen.getByTestId("driving-index-screen-stub")).toBeInTheDocument();
  });
});
