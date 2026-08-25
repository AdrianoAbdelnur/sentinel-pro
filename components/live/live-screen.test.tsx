import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { vi } from "vitest";

import * as liveApplication from "@/application/live";
import {
  buildLivePageViewModel,
  type LiveBottomPanelTab,
  type LiveState,
} from "@/application/live";
import { mergeLoadedPage } from "./live-screen";

vi.mock("./live-map", () => ({
  LiveMap: ({ markers }: { markers: { vehicleId: string }[] }) => (
    <div data-testid="live-map-stub" data-marker-count={markers.length} />
  ),
}));

import {
  BOTTOM_PANEL_EMPTY_STATE_COPY,
  BOTTOM_PANEL_TAB_COPY,
  PLAYBACK_NOTICE_COPY,
  VEHICLE_STATUS_COPY,
} from "./live-copy";
import {
  COLLAPSE_BOTTOM_PANEL_LABEL,
  EXPAND_BOTTOM_PANEL_LABEL,
} from "./live-bottom-panel";
import { LiveScreen } from "./live-screen";
import { ALL_STATUS_LABEL } from "./sidebar/live-status-filter-chips";
import {
  COLLAPSE_SIDEBAR_LABEL,
  EXPAND_SIDEBAR_LABEL,
} from "./sidebar/live-sidebar";

const liveState: LiveState = {
  fleets: [
    {
      fleetId: "fleet-north",
      label: "North Fleet",
      vehicleIds: ["vehicle-101", "vehicle-102"],
    },
    {
      fleetId: "fleet-south",
      label: "South Fleet",
      vehicleIds: ["vehicle-201"],
    },
  ],
  liveVehicles: [
    {
      vehicle: {
        id: "vehicle-101",
        fleetId: "fleet-north",
        label: "Unit 101",
        plate: "ABC123",
        isActive: true,
      },
      device: {
        id: "device-101",
        vehicleId: "vehicle-101",
        provider: "demo",
        origin: "local",
        kind: "mdvr",
        isActive: true,
      },
      telemetry: {
        deviceId: "device-101",
        online: true,
        latitude: -34.6,
        longitude: -58.4,
      },
    },
    {
      vehicle: {
        id: "vehicle-102",
        fleetId: "fleet-north",
        label: "Unit 102",
        plate: "XYZ789",
        isActive: true,
      },
      telemetry: { deviceId: "device-102", online: false },
    },
    {
      vehicle: {
        id: "vehicle-201",
        fleetId: "fleet-south",
        label: "Unit 201",
        plate: "DEF456",
        isActive: false,
      },
      telemetry: { deviceId: "device-201", online: false },
    },
  ],
};

const NOW = Date.parse("2026-07-29T12:00:00.000Z");
const STALE_AFTER_MS = 5 * 60 * 1000;

const tabs: LiveBottomPanelTab[] = [
  {
    key: "status",
    columns: [{ key: "speed" }, { key: "ignition" }],
    rows: [{ vehicleId: "vehicle-101", cells: { speed: 46 } }],
  },
  {
    key: "event",
    columns: [{ key: "lastEvent" }],
    rows: [{ vehicleId: "vehicle-101", cells: { lastEvent: "Harsh braking" } }],
  },
];

function renderScreen() {
  return render(
    <LiveScreen
      liveState={liveState}
      tabs={tabs}
      nowMs={NOW}
      staleAfterMs={STALE_AFTER_MS}
      warnings={[]}
    />,
  );
}

function fleetToggle(label: string) {
  return screen.getByRole("button", { name: new RegExp(label, "i") });
}

function vehicleCheckbox(label: string) {
  return screen.getByRole("checkbox", { name: new RegExp(label, "i") });
}

function expandBottomPanel() {
  fireEvent.click(
    screen.getByRole("button", { name: EXPAND_BOTTOM_PANEL_LABEL }),
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

function pageResponse(plate: string, page: number, totalPages = 3) {
  return new Response(JSON.stringify({
    fleets: [{ fleetId: "fleet-page", label: "Page Fleet", vehicleIds: [`vehicle-${plate}`], vehicleCount: 1, isLoaded: true }],
    liveVehicles: [{ vehicle: { id: `vehicle-${plate}`, fleetId: "fleet-page", plate, isActive: true } }],
    pagination: { page, pageSize: 50, totalItems: totalPages * 50, totalPages },
  }), { status: 200, headers: { "content-type": "application/json" } });
}

describe("LiveScreen layout", () => {
  it("keeps the map mounted with nothing selected", () => {
    renderScreen();

    expect(
      screen.getByRole("region", { name: /mapa en vivo/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Seleccione al menos un vehículo para verlo en el mapa."),
    ).not.toBeInTheDocument();
  });

  it("starts with the bottom panel collapsed", () => {
    renderScreen();

    expect(
      screen.getByRole("button", { name: EXPAND_BOTTOM_PANEL_LABEL }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(BOTTOM_PANEL_EMPTY_STATE_COPY["no-selection"]),
    ).not.toBeInTheDocument();
  });

  it("collapses and restores the sidebar independently", () => {
    renderScreen();

    fireEvent.click(
      screen.getByRole("button", { name: COLLAPSE_SIDEBAR_LABEL }),
    );
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: /mapa en vivo/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tablist")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: EXPAND_SIDEBAR_LABEL }),
    );
    expect(screen.getByRole("searchbox")).toBeInTheDocument();
  });

  it("expands and collapses the bottom panel independently", () => {
    renderScreen();

    fireEvent.click(
      screen.getByRole("button", { name: EXPAND_BOTTOM_PANEL_LABEL }),
    );
    expect(
      screen.getByText(BOTTOM_PANEL_EMPTY_STATE_COPY["no-selection"]),
    ).toBeInTheDocument();
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.getByRole("searchbox")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: COLLAPSE_BOTTOM_PANEL_LABEL }),
    );
    expect(
      screen.queryByText(BOTTOM_PANEL_EMPTY_STATE_COPY["no-selection"]),
    ).not.toBeInTheDocument();
  });
});

describe("LiveScreen", () => {
  it("replaces the summary roster with only the requested global page", () => {
    const current: LiveState = {
      fleets: [
        { fleetId: "group-1", label: "North", vehicleIds: [], vehicleCount: 40, isLoaded: false },
        { fleetId: "group-2", label: "South", vehicleIds: [], vehicleCount: 40, isLoaded: false },
      ],
      liveVehicles: [],
    };
    const loaded: LiveState = {
      fleets: [{ fleetId: "group-1", label: "North", vehicleIds: ["vehicle-1"], vehicleCount: 40, isLoaded: true }],
      liveVehicles: [{ vehicle: { id: "vehicle-1", fleetId: "group-1", plate: "AAA111", isActive: true } }],
      pagination: { page: 1, pageSize: 50, totalItems: 80, totalPages: 2 },
    };

    expect(mergeLoadedPage(current, loaded)).toEqual(loaded);
  });

  it("loads the global page once on entry", async () => {
    const pageResponse = () => new Response(JSON.stringify({
      fleets: [{ fleetId: "fleet-lazy", label: "Lazy Fleet", vehicleIds: ["vehicle-lazy"], vehicleCount: 1, isLoaded: true }],
      liveVehicles: [{
        vehicle: { id: "vehicle-lazy", fleetId: "fleet-lazy", plate: "LAZY123", isActive: true },
      }],
    }), { status: 200, headers: { "content-type": "application/json" } });
    const fetch = vi.fn().mockImplementation(() => pageResponse());
    vi.stubGlobal("fetch", fetch);

    render(
      <LiveScreen
        liveState={{ fleets: [{ fleetId: "fleet-lazy", label: "Lazy Fleet", vehicleIds: [], vehicleCount: 1, isLoaded: false }], liveVehicles: [] }}
        tabs={[]}
        nowMs={NOW}
        staleAfterMs={STALE_AFTER_MS}
        warnings={[]}
      />,
    );

    await waitFor(() => expect(screen.getByRole("button", { name: /Lazy Fleet/i })).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText("LAZY123")).toBeInTheDocument());
    expect(fetch).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it("refreshes the active page every 15 seconds", async () => {
    vi.useFakeTimers();
    const pageResponse = () => new Response(JSON.stringify({ fleets: [], liveVehicles: [], pagination: { page: 1, pageSize: 50, totalItems: 0, totalPages: 1 } }), { status: 200, headers: { "content-type": "application/json" } });
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(pageResponse()));
    vi.stubGlobal("fetch", fetch);

    renderScreen();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(15_000);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));

    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("does not let a late page response overwrite the latest page", async () => {
    const initial = deferred<Response>();
    const page2 = deferred<Response>();
    const page3 = deferred<Response>();
    const fetch = vi.fn()
      .mockReturnValueOnce(initial.promise)
      .mockReturnValueOnce(page2.promise)
      .mockReturnValueOnce(page3.promise);
    vi.stubGlobal("fetch", fetch);

    renderScreen();
    initial.resolve(pageResponse("PAGE1", 1));
    await waitFor(() => expect(screen.getByRole("button", { name: /2$/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /2$/ }));
    fireEvent.click(screen.getByRole("button", { name: /3$/ }));

    page3.resolve(pageResponse("PAGE3", 3));
    await waitFor(() => expect(screen.getByText("PAGE3")).toBeInTheDocument());
    page2.resolve(pageResponse("PAGE2", 2));
    await waitFor(() => expect(screen.queryByText("PAGE2")).not.toBeInTheDocument());

    vi.unstubAllGlobals();
  });

  it("does not let an older search response overwrite a newer search", async () => {
    const initial = deferred<Response>();
    const oldSearch = deferred<Response>();
    const newSearch = deferred<Response>();
    const fetch = vi.fn()
      .mockReturnValueOnce(initial.promise)
      .mockReturnValueOnce(oldSearch.promise)
      .mockReturnValueOnce(newSearch.promise);
    vi.stubGlobal("fetch", fetch);

    renderScreen();
    initial.resolve(pageResponse("PAGE1", 1));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "old" } });
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "new" } });

    newSearch.resolve(pageResponse("NEW", 1));
    await waitFor(() => expect(screen.getByText("NEW")).toBeInTheDocument());
    oldSearch.resolve(pageResponse("OLD", 1));
    await waitFor(() => expect(screen.queryByText("OLD")).not.toBeInTheDocument());

    vi.unstubAllGlobals();
  });

  it("does not let polling overwrite a navigation that started afterward", async () => {
    vi.useFakeTimers();
    const initial = deferred<Response>();
    const polling = deferred<Response>();
    const navigation = deferred<Response>();
    const fetch = vi.fn()
      .mockReturnValueOnce(initial.promise)
      .mockReturnValueOnce(polling.promise)
      .mockReturnValueOnce(navigation.promise);
    vi.stubGlobal("fetch", fetch);

    renderScreen();
    await vi.advanceTimersByTimeAsync(0);
    initial.resolve(pageResponse("PAGE1", 1, 2));
    await vi.advanceTimersByTimeAsync(0);
    await vi.waitFor(() => expect(screen.getByRole("button", { name: /2$/ })).toBeInTheDocument());
    await vi.advanceTimersByTimeAsync(15_000);
    fireEvent.click(screen.getByRole("button", { name: /2$/ }));

    navigation.resolve(pageResponse("NAVIGATION", 2, 2));
    await vi.waitFor(() => expect(screen.getByText("NAVIGATION")).toBeInTheDocument());
    polling.resolve(pageResponse("POLLING", 1, 2));
    await vi.waitFor(() => expect(screen.queryByText("POLLING")).not.toBeInTheDocument());

    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("does not let a late legacy group response overwrite its latest page", async () => {
    const firstPage = deferred<Response>();
    const secondPage = deferred<Response>();
    const latestFirstPage = deferred<Response>();
    const groupResponse = (plate: string, page: number) => new Response(JSON.stringify({
      fleets: [{ fleetId: "fleet-lazy", label: "Lazy Fleet", vehicleIds: [`vehicle-${plate}`], vehicleCount: 2, isLoaded: false, pagination: { page, pageSize: 50, totalItems: 100, totalPages: 2 } }],
      liveVehicles: [{ vehicle: { id: `vehicle-${plate}`, fleetId: "fleet-lazy", plate, isActive: true } }],
    }), { status: 200, headers: { "content-type": "application/json" } });
    const fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/groups/")) return [firstPage.promise, secondPage.promise, latestFirstPage.promise][fetch.mock.calls.filter(([callUrl]) => String(callUrl).includes("/groups/")).length - 1];
      return Promise.resolve(new Response("", { status: 500 }));
    });
    vi.stubGlobal("fetch", fetch);

    render(
      <LiveScreen
        liveState={{ fleets: [{ fleetId: "fleet-lazy", label: "Lazy Fleet", vehicleIds: [], vehicleCount: 2, isLoaded: false }], liveVehicles: [] }}
        tabs={[]}
        nowMs={NOW}
        staleAfterMs={STALE_AFTER_MS}
        warnings={[]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Lazy Fleet/i }));
    fireEvent.click(screen.getByRole("button", { name: /Lazy Fleet/i }));
    firstPage.resolve(groupResponse("GROUP1", 1));
    await waitFor(() => expect(screen.getByText("GROUP1")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    fireEvent.click(screen.getByRole("button", { name: /Lazy Fleet/i }));
    fireEvent.click(screen.getByRole("button", { name: /Lazy Fleet/i }));
    latestFirstPage.resolve(groupResponse("LATEST1", 1));
    await waitFor(() => expect(screen.getByText("LATEST1")).toBeInTheDocument());
    secondPage.resolve(groupResponse("GROUP2", 2));
    await waitFor(() => expect(screen.queryByText("GROUP2")).not.toBeInTheDocument());

    vi.unstubAllGlobals();
  });

  it("does not let a late legacy group response overwrite a newer global page", async () => {
    const groupLoad = deferred<Response>();
    const replacementGroupLoad = deferred<Response>();
    const globalPage = deferred<Response>();
    const groupResponse = new Response(JSON.stringify({
      fleets: [{ fleetId: "fleet-lazy", label: "Lazy Fleet", vehicleIds: ["vehicle-group"], vehicleCount: 1, isLoaded: true }],
      liveVehicles: [{ vehicle: { id: "vehicle-group", fleetId: "fleet-lazy", plate: "GROUP", isActive: true } }],
    }), { status: 200, headers: { "content-type": "application/json" } });
    const replacementGroupResponse = new Response(JSON.stringify({
      fleets: [{ fleetId: "fleet-lazy", label: "Lazy Fleet", vehicleIds: ["vehicle-new-group"], vehicleCount: 1, isLoaded: false }],
      liveVehicles: [{ vehicle: { id: "vehicle-new-group", fleetId: "fleet-lazy", plate: "NEWGROUP", isActive: true } }],
    }), { status: 200, headers: { "content-type": "application/json" } });
    const fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/groups/")) {
        return fetch.mock.calls.filter(([callUrl]) => String(callUrl).includes("/groups/")).length === 1
          ? groupLoad.promise
          : replacementGroupLoad.promise;
      }
      if (url.includes("page=2")) return globalPage.promise;
      return Promise.resolve(new Response("", { status: 500 }));
    });
    vi.stubGlobal("fetch", fetch);

    render(
      <LiveScreen
        liveState={{
          fleets: [{ fleetId: "fleet-lazy", label: "Lazy Fleet", vehicleIds: [], vehicleCount: 1, isLoaded: false }],
          liveVehicles: [],
          pagination: { page: 1, pageSize: 50, totalItems: 100, totalPages: 2 },
        }}
        tabs={[]}
        nowMs={NOW}
        staleAfterMs={STALE_AFTER_MS}
        warnings={[]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Lazy Fleet/i }));
    fireEvent.click(screen.getByRole("button", { name: /Lazy Fleet/i }));
    fireEvent.click(screen.getByRole("button", { name: /2$/ }));
    globalPage.resolve(new Response(JSON.stringify({
      fleets: [{ fleetId: "fleet-lazy", label: "Lazy Fleet", vehicleIds: ["vehicle-global"], vehicleCount: 1, isLoaded: false }],
      liveVehicles: [{ vehicle: { id: "vehicle-global", fleetId: "fleet-lazy", plate: "GLOBAL2", isActive: true } }],
      pagination: { page: 2, pageSize: 50, totalItems: 100, totalPages: 2 },
    }), { status: 200, headers: { "content-type": "application/json" } }));
    await waitFor(() => expect(screen.getByText("GLOBAL2")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Lazy Fleet/i }));
    fireEvent.click(screen.getByRole("button", { name: /Lazy Fleet/i }));
    replacementGroupLoad.resolve(replacementGroupResponse);
    await waitFor(() => expect(screen.getByText("NEWGROUP")).toBeInTheDocument());
    groupLoad.resolve(groupResponse);
    await waitFor(() => expect(screen.queryByText("GROUP")).not.toBeInTheDocument());

    vi.unstubAllGlobals();
  });

  it("keeps the successful roster visible beside source warnings", () => {
    render(
      <LiveScreen
        liveState={liveState}
        tabs={tabs}
        nowMs={NOW}
        staleAfterMs={STALE_AFTER_MS}
        warnings={[
          {
            code: "source-unavailable",
            sourceId: "howen",
            sourceLabel: "HOWEN",
          },
        ]}
      />,
    );

    expect(screen.getByText(/información de HOWEN/)).toBeInTheDocument();
    expect(fleetToggle("North Fleet")).toBeInTheDocument();
  });

  it("renders every fleet", () => {
    renderScreen();

    expect(fleetToggle("North Fleet")).toBeInTheDocument();
    expect(fleetToggle("South Fleet")).toBeInTheDocument();
  });

  it("expands every fleet on first render", () => {
    renderScreen();

    expect(screen.getByText("Unit 101")).toBeInTheDocument();
  });

  it("reveals the vehicles of an expanded fleet", () => {
    renderScreen();

    expect(screen.getByText("Unit 101")).toBeInTheDocument();
    expect(screen.getByText("Unit 102")).toBeInTheDocument();
  });

  it("shows the empty state until a vehicle is selected", () => {
    renderScreen();
    expandBottomPanel();

    expect(
      screen.getByText(BOTTOM_PANEL_EMPTY_STATE_COPY["no-selection"]),
    ).toBeInTheDocument();
  });

  it("adds a row to the bottom panel when a vehicle is selected", () => {
    renderScreen();

    fireEvent.click(vehicleCheckbox("Unit 101"));
    expandBottomPanel();

    const table = screen.getByRole("table");
    expect(within(table).getByText("Unit 101")).toBeInTheDocument();
    expect(within(table).getByText("46")).toBeInTheDocument();
    expect(
      screen.queryByText(BOTTOM_PANEL_EMPTY_STATE_COPY["no-selection"]),
    ).not.toBeInTheDocument();
  });

  it("renders a fallback marker for missing cell values", () => {
    renderScreen();
    fireEvent.click(vehicleCheckbox("Unit 101"));
    expandBottomPanel();

    const row = screen.getByRole("row", { name: /unit 101/i });
    expect(within(row).getByText("—")).toBeInTheDocument();
  });

  it("selects every vehicle of a fleet from the fleet checkbox", () => {
    renderScreen();

    fireEvent.click(
      vehicleCheckbox("Seleccionar todos los vehículos de North Fleet"),
    );

    expect(vehicleCheckbox("Unit 101")).toBeChecked();
    expect(vehicleCheckbox("Unit 102")).toBeChecked();
  });

  it("narrows the rendered fleets when searching by plate", () => {
    renderScreen();

    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "DEF456" },
    });

    expect(screen.queryByText("North Fleet")).not.toBeInTheDocument();
    expect(screen.getByText("Unit 201")).toBeInTheDocument();
    fireEvent.click(fleetToggle("South Fleet"));
    expect(screen.queryByText("Unit 201")).not.toBeInTheDocument();
  });

  it("narrows to vehicles matching the selected status chip", () => {
    renderScreen();

    fireEvent.click(
      screen.getByRole("button", { name: VEHICLE_STATUS_COPY.stopped }),
    );

    expect(screen.getByText("Unit 101")).toBeInTheDocument();
    expect(screen.queryByText("Unit 102")).not.toBeInTheDocument();
    expect(screen.queryByText("South Fleet")).not.toBeInTheDocument();
  });

  it("filters by provider without controlling fleet expansion", () => {
    renderScreen();

    fireEvent.change(screen.getByRole("combobox", { name: /proveedor/i }), {
      target: { value: "demo" },
    });

    expect(screen.getByText("Unit 101")).toBeInTheDocument();
    expect(screen.queryByText("Unit 102")).not.toBeInTheDocument();
  });

  it.each([
    {
      name: "status",
      apply: () =>
        fireEvent.click(
          screen.getByRole("button", { name: VEHICLE_STATUS_COPY.stopped }),
        ),
      change: () => fireEvent.click(screen.getByRole("button", { name: ALL_STATUS_LABEL })),
    },
    {
      name: "provider",
      apply: () =>
        fireEvent.change(screen.getByRole("combobox", { name: /proveedor/i }), {
          target: { value: "demo" },
        }),
      change: () =>
        fireEvent.change(screen.getByRole("combobox", { name: /proveedor/i }), {
          target: { value: "all" },
        }),
    },
    {
      name: "search",
      apply: () =>
        fireEvent.change(screen.getByRole("searchbox"), {
          target: { value: "ABC123" },
        }),
      change: () => fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } }),
    },
  ])("keeps a fleet expanded after applying and changing a $name filter", ({ apply, change }) => {
    renderScreen();
    expect(screen.getByText("Unit 101")).toBeInTheDocument();

    apply();
    expect(screen.getByText("Unit 101")).toBeInTheDocument();

    change();
    expect(fleetToggle("North Fleet")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Unit 101")).toBeInTheDocument();
  });

  it("returns to the full roster when the status filter is reset to Todos", () => {
    renderScreen();

    fireEvent.click(
      screen.getByRole("button", { name: VEHICLE_STATUS_COPY.stopped }),
    );
    fireEvent.click(screen.getByRole("button", { name: ALL_STATUS_LABEL }));

    expect(screen.getByText("North Fleet")).toBeInTheDocument();
    expect(screen.getByText("South Fleet")).toBeInTheDocument();
  });

  it("keeps the map clean while nothing is selected", () => {
    renderScreen();

    expect(
      screen.queryByText("Seleccione al menos un vehículo para verlo en el mapa."),
    ).not.toBeInTheDocument();
  });

  it("does not render a playback notice before the playback monitor exists", () => {
    const pageWithNotice = buildLivePageViewModel({
      liveState,
      selectedVehicleIds: [],
      searchTerm: "",
      activeTab: "status",
      tabs,
      nowMs: NOW,
      staleAfterMs: STALE_AFTER_MS,
      playback: {
        isOpen: false,
        notice: { code: "vehicle-offline" },
      },
    });
    const buildPageSpy = vi
      .spyOn(liveApplication, "buildLivePageViewModel")
      .mockReturnValueOnce(pageWithNotice);

    renderScreen();

    expect(buildPageSpy).toHaveBeenCalled();
    expect(
      screen.queryByText(PLAYBACK_NOTICE_COPY["vehicle-offline"]),
    ).not.toBeInTheDocument();

    buildPageSpy.mockRestore();
  });

  it("keeps the map mounted once a mappable vehicle is selected", () => {
    renderScreen();

    fireEvent.click(vehicleCheckbox("Unit 101"));

    expect(
      screen.getByRole("region", { name: /mapa en vivo/i }),
    ).toBeInTheDocument();
  });

  it("keeps the selection when the active tab changes", () => {
    renderScreen();
    fireEvent.click(vehicleCheckbox("Unit 101"));
    expandBottomPanel();

    fireEvent.click(
      screen.getByRole("tab", { name: BOTTOM_PANEL_TAB_COPY.event }),
    );

    const table = screen.getByRole("table");
    expect(within(table).getByText("Unit 101")).toBeInTheDocument();
    expect(within(table).getByText("Harsh braking")).toBeInTheDocument();
    expect(vehicleCheckbox("Unit 101")).toBeChecked();
  });
});
