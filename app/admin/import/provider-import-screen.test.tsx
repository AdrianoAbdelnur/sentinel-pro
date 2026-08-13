import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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
