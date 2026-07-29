import type { Device, DeviceTelemetry, Vehicle } from "@/domain/live";
import type {
  LiveBottomPanelTab,
  LiveDataSource,
  LiveFleetState,
  LiveState,
  LiveVehicleState,
} from "@/application/live";

const CUSTOMER_ID = "customer-demo";

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
    fleetId: "fleet-deposito-norte",
    label: "Depósito Norte",
    vehicleIds: [],
  },
];

const fixtureLiveVehicles: FixtureLiveVehicle[] = [
  {
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
      {
        vehicleId: "vehicle-201",
        cells: { speed: 0, ignition: false, network: "4G" },
      },
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
