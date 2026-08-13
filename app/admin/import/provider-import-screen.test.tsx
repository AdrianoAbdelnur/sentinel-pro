import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { routerReplace } = vi.hoisted(() => ({ routerReplace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: routerReplace }),
}));

import { ProviderImportScreen } from "./provider-import-screen";

function stream(events: unknown[]) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(events.map((event) => `${JSON.stringify(event)}\n`).join("")));
      controller.close();
    },
  });
}

describe("ProviderImportScreen", () => {
  it("redirects to login when the Sentinel session is rejected", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 403 })));
    render(<ProviderImportScreen />);

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(routerReplace).toHaveBeenCalledWith("/login"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    routerReplace.mockReset();
  });

  it("keeps authenticated provider failures on the import screen", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(stream([
      { type: "result", data: { provider: "howen", status: "failed", code: "provider-failure" } },
    ]))));
    render(<ProviderImportScreen />);

    fireEvent.click(screen.getByRole("button"));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(routerReplace).not.toHaveBeenCalled();
  });

  it("renders streamed counters before the import finishes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(stream([
      { type: "progress", data: { phase: "saving", found: { companies: 1, fleets: 2, vehicles: 1500 }, total: 1500, processed: 420, counts: { processed: 420, created: 400, linked: 15, reviewed: 5, rejected: 0, absent: 0 } } },
      { type: "result", data: { provider: "howen", status: "succeeded", found: { companies: 1, fleets: 2, vehicles: 1500 }, companies: 1, fleets: 1, counts: { processed: 1500, created: 1400, linked: 80, reviewed: 20, rejected: 0, absent: 0 } } },
    ]))));
    render(<ProviderImportScreen />);

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "howen" } });
    fireEvent.click(screen.getByRole("button", { name: "Importar empresas y vehículos" }));

    expect(await screen.findByText("Importación completada en 0:00.")).toBeInTheDocument();
    expect(screen.getAllByText("1.500")).toHaveLength(2);
    expect(screen.getByText("1.400")).toBeInTheDocument();
    expect(screen.getByText("Flotas detectadas")).toBeInTheDocument();
  });
});
