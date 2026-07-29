import type { Device, DeviceTelemetry, Vehicle } from "@/domain/live";
import type {
  LiveBottomPanelTab,
  LiveDataSource,
  LiveFleetState,
  LiveState,
  LiveVehicleState,
} from "@/application/live";

const CUSTOMER_ID = "customer-demo";

// Relative age, not a literal timestamp: `readLiveState()` materializes `gpsAt`
// against `Date.now()` on every call, so the fixture never rots into "every
// vehicle is offline". Omitting `gpsAgoMs` means "no position report ever".
type FixtureTelemetry = Omit<DeviceTelemetry, "gpsAt"> & {
  gpsAgoMs?: number;
};

type FixtureLiveVehicle = {
  vehicle: Vehicle;
  device?: Device;
  telemetry?: FixtureTelemetry;
};

const fleets: LiveFleetState[] = [
  {
    fleetId: "fleet-ab-construcciones",
    label: "AB Construcciones",
    vehicleIds: ["vehicle-101", "vehicle-102"],
  },
  {
    // Named like a sub-fleet of the one above, but listed flat on purpose:
    // fleets have no hierarchy.
    fleetId: "fleet-ab-construcciones-rio-tinto",
    label: "AB Construcciones (Rio Tinto)",
    vehicleIds: ["vehicle-201", "vehicle-202"],
  },
  {
    fleetId: "fleet-transporte-del-sur",
    label: "Transporte del Sur",
    vehicleIds: ["vehicle-301", "vehicle-302", "vehicle-303"],
  },
  {
    // Zero vehicles: exercises `counts.total = 0`, and the rule that an empty
    // fleet survives while nothing is narrowing.
    fleetId: "fleet-deposito-norte",
    label: "Depósito Norte",
    vehicleIds: [],
  },
];

const fixtureLiveVehicles: FixtureLiveVehicle[] = [
  {
    // Happy path: online, moving. Resolves "en-route".
    vehicle: {
      id: "vehicle-101",
      customerId: CUSTOMER_ID,
      fleetId: "fleet-ab-construcciones",
      label: "Unidad 101",
      plate: "AE101GH",
      internalCode: "ABC-01",
      isActive: true,
    },
    device: {
      id: "device-101",
      vehicleId: "vehicle-101",
      provider: "howen",
      origin: "howen",
      kind: "mdvr",
      channelCount: 4,
      isActive: true,
    },
    telemetry: {
      deviceId: "device-101",
      online: true,
      gpsAgoMs: 30_000, // 30s ago
      latitude: -34.6037,
      longitude: -58.3816,
      speedKmH: 46,
      headingDeg: 90,
      ignitionOn: true,
      network: "4G",
    },
  },
  {
    // `online: false` beats a fresh report and a non-zero speed: resolves
    // "offline", and the stored speed must be suppressed. Do not "fix" the
    // apparent inconsistency.
    vehicle: {
      id: "vehicle-102",
      customerId: CUSTOMER_ID,
      fleetId: "fleet-ab-construcciones",
      label: "Unidad 102",
      plate: "AE102GH",
      internalCode: "ABC-02",
      isActive: true,
    },
    device: {
      id: "device-102",
      vehicleId: "vehicle-102",
      provider: "howen",
      origin: "howen",
      kind: "dashcam",
      channelCount: 2,
      isActive: true,
    },
    telemetry: {
      deviceId: "device-102",
      online: false,
      gpsAgoMs: 20_000, // fresh, and irrelevant: the flag wins
      speedKmH: 55,
      ignitionOn: true,
      network: "4G",
    },
  },
  {
    // No `online` flag, fresh report: online via the staleness fallback, then
    // "stopped" on a genuine zero speed.
    vehicle: {
      id: "vehicle-201",
      customerId: CUSTOMER_ID,
      fleetId: "fleet-ab-construcciones-rio-tinto",
      label: "Unidad 201",
      plate: "AE201JK",
      internalCode: "RT-01",
      isActive: true,
    },
    device: {
      id: "device-201",
      vehicleId: "vehicle-201",
      provider: "praxsys",
      origin: "other",
      kind: "mdvr",
      channelCount: 4,
      isActive: true,
    },
    telemetry: {
      deviceId: "device-201",
      gpsAgoMs: 2 * 60_000, // inside the 5 min threshold
      latitude: -31.4201,
      longitude: -64.1888,
      speedKmH: 0,
      headingDeg: 180,
      ignitionOn: false,
      network: "4G",
    },
  },
  {
    // No `online` flag, stale report: offline via the staleness fallback,
    // suppressing a non-zero stored speed.
    vehicle: {
      id: "vehicle-202",
      customerId: CUSTOMER_ID,
      fleetId: "fleet-ab-construcciones-rio-tinto",
      label: "Unidad 202",
      plate: "AE202JK",
      internalCode: "RT-02",
      isActive: true,
    },
    device: {
      id: "device-202",
      vehicleId: "vehicle-202",
      provider: "praxsys",
      origin: "other",
      kind: "dashcam",
      channelCount: 2,
      isActive: true,
    },
    telemetry: {
      deviceId: "device-202",
      gpsAgoMs: 9 * 60_000, // past the 5 min threshold
      speedKmH: 55,
      ignitionOn: true,
      network: "3G",
    },
  },
  {
    // `online: true` with no position report at all: online, no speed to read,
    // so "stopped".
    vehicle: {
      id: "vehicle-301",
      customerId: CUSTOMER_ID,
      fleetId: "fleet-transporte-del-sur",
      label: "Unidad 301",
      plate: "AE301LM",
      internalCode: "TS-01",
      isActive: true,
    },
    device: {
      id: "device-301",
      vehicleId: "vehicle-301",
      provider: "sentinelpro",
      origin: "other",
      kind: "ipc",
      channelCount: 1,
      isActive: true,
    },
    telemetry: {
      deviceId: "device-301",
      online: true,
    },
  },
  {
    // No telemetry and an inactive device: offline, and `canOpenLive` false on
    // both of its clauses.
    vehicle: {
      id: "vehicle-302",
      customerId: CUSTOMER_ID,
      fleetId: "fleet-transporte-del-sur",
      label: "Unidad 302",
      plate: "AE302LM",
      internalCode: "TS-02",
      isActive: true,
    },
    device: {
      id: "device-302",
      vehicleId: "vehicle-302",
      provider: "sentinelpro",
      origin: "other",
      kind: "other",
      isActive: false,
    },
  },
  {
    // No device and no telemetry: offline, no provider badge, and absent from
    // the provider dropdown.
    vehicle: {
      id: "vehicle-303",
      customerId: CUSTOMER_ID,
      fleetId: "fleet-transporte-del-sur",
      label: "Unidad 303",
      plate: "AE303LM",
      internalCode: "TS-03",
      isActive: true,
    },
  },
];

const bottomPanelTabs: LiveBottomPanelTab[] = [
  {
    key: "status",
    columns: [{ key: "speed" }, { key: "ignition" }, { key: "network" }],
    rows: [
      {
        vehicleId: "vehicle-101",
        cells: { speed: 46, ignition: true, network: "4G" },
      },
      // No row for vehicle-102: it is offline and reports nothing.
      {
        vehicleId: "vehicle-201",
        cells: { speed: 0, ignition: false, network: "4G" },
      },
      // Partial row: only speed is reported for this device.
      { vehicleId: "vehicle-202", cells: { speed: 55 } },
    ],
  },
  {
    key: "event",
    columns: [{ key: "lastEvent" }, { key: "occurredAt" }],
    rows: [
      {
        vehicleId: "vehicle-101",
        cells: { lastEvent: "Harsh braking", occurredAt: "11:42" },
      },
      {
        vehicleId: "vehicle-201",
        cells: { lastEvent: "Ignition off", occurredAt: "10:07" },
      },
    ],
  },
  {
    key: "normalAlarm",
    columns: [{ key: "alarm" }, { key: "severity" }],
    rows: [
      { vehicleId: "vehicle-201", cells: { alarm: "Overspeed", severity: "High" } },
    ],
  },
  {
    key: "aiAlarm",
    columns: [{ key: "alarm" }, { key: "confidence" }],
    rows: [
      {
        vehicleId: "vehicle-101",
        cells: { alarm: "Distraction", confidence: "0.82" },
      },
    ],
  },
  {
    key: "driverSwipe",
    columns: [{ key: "driver" }, { key: "swipedAt" }],
    rows: [
      { vehicleId: "vehicle-101", cells: { driver: "A. Gómez", swipedAt: "08:15" } },
    ],
  },
];

function materializeTelemetry(
  telemetry: FixtureTelemetry | undefined,
  nowMs: number,
): DeviceTelemetry | undefined {
  if (!telemetry) {
    return undefined;
  }

  const { gpsAgoMs, ...rest } = telemetry;

  return {
    ...rest,
    ...(gpsAgoMs !== undefined
      ? { gpsAt: new Date(nowMs - gpsAgoMs).toISOString() }
      : {}),
  };
}

function materializeLiveVehicles(nowMs: number): LiveVehicleState[] {
  return fixtureLiveVehicles.map(({ vehicle, device, telemetry }) => ({
    vehicle,
    device,
    telemetry: materializeTelemetry(telemetry, nowMs),
  }));
}

export const inMemoryLiveDataSource: LiveDataSource = {
  readLiveState(): LiveState {
    return structuredClone({
      fleets,
      liveVehicles: materializeLiveVehicles(Date.now()),
    });
  },

  readBottomPanelTabs(): LiveBottomPanelTab[] {
    return structuredClone(bottomPanelTabs);
  },
};
