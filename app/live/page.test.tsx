import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { LiveState, OperationalSource } from "@/application/live";

vi.mock("../require-page-authorization", () => ({ requirePageAuthorization: vi.fn().mockResolvedValue({ userId: "u", organizationId: "o", role: "operator" }) }));

const sourceComposition = vi.hoisted(() => ({
  sources: [] as OperationalSource[],
  create: vi.fn(),
}));

const catalogComposition = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock("./create-operational-sources", () => ({
  createOperationalSources: sourceComposition.create,
}));

vi.mock("./create-catalog-source", () => ({
  createCatalogSource: catalogComposition.create,
}));

vi.mock("./live-logout-button", () => ({
  LiveLogoutButton: () => <button type="button">Cerrar sesión</button>,
}));

vi.mock("@/components/live/live-map", () => ({
  LiveMap: ({ markers }: { markers: { vehicleId: string }[] }) => (
    <div data-testid="live-map-stub" data-marker-count={markers.length} />
  ),
}));

import LivePage, { metadata } from "./page";

function source(
  id: string,
  label: string,
  result:
    | { kind: "success"; state: LiveState }
    | { kind: "failure"; code: "unavailable" },
): OperationalSource {
  return {
    identity: { id, label },
    loadSnapshot: vi.fn().mockResolvedValue(result),
  };
}

const howenState: LiveState = {
  fleets: [
    {
      fleetId: "howen:fleet:119",
      label: "TRAVIL SAS",
      vehicleIds: ["howen:vehicle:technical-1"],
    },
  ],
  liveVehicles: [
    {
      vehicle: {
        id: "howen:vehicle:technical-1",
        fleetId: "howen:fleet:119",
        plate: "AA264KK",
        isActive: true,
      },
      device: {
        id: "howen:device:technical-1",
        vehicleId: "howen:vehicle:technical-1",
        externalId: "technical-1",
        provider: "HOWEN",
        origin: "howen",
        kind: "mdvr",
        isActive: true,
      },
      telemetry: {
        deviceId: "howen:device:technical-1",
        online: true,
      },
    },
  ],
};

describe("LivePage metadata", () => {
  it("uses the Unicode middle dot in the live title", () => {
    expect(metadata.title).toBe("Live \u00b7 Sentinel Pro");
  });
});

describe("LivePage operational composition", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    sourceComposition.sources = [];
    sourceComposition.create.mockReset();
    catalogComposition.create.mockReset();
  });

  it("uses the organization-scoped canonical catalog as the only production source", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const catalog = source("canonical-catalog", "Catálogo", { kind: "success", state: howenState });
    catalogComposition.create.mockReturnValue(catalog);
    sourceComposition.create.mockImplementation((_config, dependencies) => [dependencies.catalogSource]);

    render(await LivePage());

    expect(catalogComposition.create).toHaveBeenCalledWith("o");
    expect(sourceComposition.create).toHaveBeenCalledWith(expect.objectContaining({ includeDevelopmentFixtures: false }), { catalogSource: catalog });
    expect(catalog.loadSnapshot).toHaveBeenCalledOnce();
  });

  it("aggregates configured sources once and retains successful Howen data beside a warning", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const howen = source("howen", "HOWEN", {
      kind: "success",
      state: howenState,
    });
    const unavailable = source("praxsys", "PRAXSYS", {
      kind: "failure",
      code: "unavailable",
    });
    sourceComposition.sources = [howen, unavailable];
    sourceComposition.create.mockReturnValue(sourceComposition.sources);

    render(await LivePage());

    expect(sourceComposition.create).toHaveBeenCalledOnce();
    expect(howen.loadSnapshot).toHaveBeenCalledOnce();
    expect(unavailable.loadSnapshot).toHaveBeenCalledOnce();
    expect(screen.getByText("TRAVIL SAS")).toBeInTheDocument();
    expect(screen.getByRole("status").textContent).toMatch(/PRAXSYS|HOWEN/);
  });

  it("shows the plate and provider without exposing the technical Howen id", async () => {
    vi.stubEnv("NODE_ENV", "production");
    sourceComposition.sources = [
      source("howen", "HOWEN", { kind: "success", state: howenState }),
    ];
    sourceComposition.create.mockReturnValue(sourceComposition.sources);

    render(await LivePage());
    expect(screen.getByText("AA264KK")).toBeInTheDocument();
    expect(screen.getAllByText("HOWEN")).toHaveLength(2);
    expect(screen.queryByText("technical-1")).not.toBeInTheDocument();
  });

  it("renders an empty roster and every warning when all sources fail", async () => {
    vi.stubEnv("NODE_ENV", "production");
    sourceComposition.sources = [
      source("howen", "HOWEN", { kind: "failure", code: "unavailable" }),
      source("praxsys", "PRAXSYS", {
        kind: "failure",
        code: "unavailable",
      }),
    ];
    sourceComposition.create.mockReturnValue(sourceComposition.sources);

    render(await LivePage());

    expect(screen.getByRole("status")).toHaveTextContent("PRAXSYS");
    expect(screen.getByRole("status")).toHaveTextContent("HOWEN");
    expect(screen.queryByRole("button", { name: /TRAVIL SAS/i })).not.toBeInTheDocument();
  });

  it("does not send bottom-panel demo tabs to the client in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    sourceComposition.sources = [
      source("howen", "HOWEN", { kind: "success", state: howenState }),
    ];
    sourceComposition.create.mockReturnValue(sourceComposition.sources);

    render(await LivePage());

    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("does not send bottom-panel demo tabs during local development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    sourceComposition.sources = [
      source("howen", "HOWEN", { kind: "success", state: howenState }),
    ];
    sourceComposition.create.mockReturnValue(sourceComposition.sources);

    render(await LivePage());

    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });
});
