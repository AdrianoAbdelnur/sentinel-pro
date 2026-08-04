import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

const notFound = vi.hoisted(() => vi.fn(() => {
  throw new Error("not-found");
}));

vi.mock("next/navigation", () => ({ notFound }));
vi.mock("@/components/live/live-map-clustering-harness", () => ({
  LiveMapClusteringHarness: () => <div>Harness ready</div>,
}));

const { default: HarnessPage } = await import("./page");

describe("LiveMapClusteringHarnessPage", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders the harness only during development", () => {
    vi.stubEnv("NODE_ENV", "development");

    render(<HarnessPage />);

    expect(screen.getByText("Harness ready")).toBeInTheDocument();
    expect(notFound).not.toHaveBeenCalled();
  });

  it("returns not found outside development", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(() => HarnessPage()).toThrow("not-found");
    expect(notFound).toHaveBeenCalledTimes(1);
  });
});
