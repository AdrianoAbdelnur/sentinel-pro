import type {
  LiveBottomPanelTab,
  LiveDataSource,
  LiveFleetState,
  LiveState,
  LiveVehicleState,
} from "@/application/live";

const CUSTOMER_ID = "customer-demo";

const fleets: LiveFleetState[] = [
  {
    fleetId: "fleet-north",
    label: "North Fleet",
    vehicleIds: ["vehicle-101", "vehicle-102"],
  },
  {
    fleetId: "fleet-south",
    label: "South Fleet",
    vehicleIds: ["vehicle-201", "vehicle-202"],
  },
];

const liveVehicles: LiveVehicleState[] = [
  {
    vehicle: {
      id: "vehicle-101",
      customerId: CUSTOMER_ID,
      fleetId: "fleet-north",
      label: "Unit 101",
      plate: "ABC123",
      internalCode: "N-01",
      isActive: true,
    },
    device: {
      id: "device-101",
      vehicleId: "vehicle-101",
      provider: "demo",
      origin: "local",
      kind: "mdvr",
      channelCount: 4,
      isActive: true,
    },
    telemetry: {
      deviceId: "device-101",
      online: true,
      gpsAt: "2026-07-28T12:00:00.000Z",
      latitude: -34.6037,
      longitude: -58.3816,
      speedKmH: 46,
      headingDeg: 90,
      ignitionOn: true,
      network: "4G",
    },
  },
  {
    // Offline and without GPS: exercises the degraded sidebar and table states.
    vehicle: {
      id: "vehicle-102",
      customerId: CUSTOMER_ID,
      fleetId: "fleet-north",
      label: "Unit 102",
      plate: "XYZ789",
      internalCode: "N-02",
      isActive: true,
    },
    device: {
      id: "device-102",
      vehicleId: "vehicle-102",
      provider: "demo",
      origin: "local",
      kind: "dashcam",
      channelCount: 2,
      isActive: true,
    },
    telemetry: {
      deviceId: "device-102",
      online: false,
    },
  },
  {
    vehicle: {
      id: "vehicle-201",
      customerId: CUSTOMER_ID,
      fleetId: "fleet-south",
      label: "Unit 201",
      plate: "DEF456",
      internalCode: "S-01",
      isActive: true,
    },
    device: {
      id: "device-201",
      vehicleId: "vehicle-201",
      provider: "demo",
      origin: "local",
      kind: "mdvr",
      channelCount: 4,
      isActive: true,
    },
    telemetry: {
      deviceId: "device-201",
      online: true,
      gpsAt: "2026-07-28T12:00:00.000Z",
      latitude: -34.9011,
      longitude: -56.1645,
      speedKmH: 0,
      headingDeg: 180,
      ignitionOn: false,
      network: "4G",
    },
  },
  {
    // Online but with an inactive device: cannot open live even though it reports.
    vehicle: {
      id: "vehicle-202",
      customerId: CUSTOMER_ID,
      fleetId: "fleet-south",
      label: "Unit 202",
      plate: "GHI789",
      internalCode: "S-02",
      isActive: false,
    },
    device: {
      id: "device-202",
      vehicleId: "vehicle-202",
      provider: "demo",
      origin: "local",
      kind: "ipc",
      channelCount: 1,
      isActive: false,
    },
    telemetry: {
      deviceId: "device-202",
      online: true,
      speedKmH: 12,
    },
  },
];

const bottomPanelTabs: LiveBottomPanelTab[] = [
  {
    key: "status",
    label: "Status",
    columns: [
      { key: "speed", label: "Speed (km/h)" },
      { key: "ignition", label: "Ignition" },
      { key: "network", label: "Network" },
    ],
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
      // Partial row: an online device that only reports speed.
      { vehicleId: "vehicle-202", cells: { speed: 12 } },
    ],
  },
  {
    key: "event",
    label: "Event",
    columns: [
      { key: "lastEvent", label: "Last event" },
      { key: "occurredAt", label: "Occurred at" },
    ],
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
    label: "Alarms",
    columns: [
      { key: "alarm", label: "Alarm" },
      { key: "severity", label: "Severity" },
    ],
    rows: [
      { vehicleId: "vehicle-201", cells: { alarm: "Overspeed", severity: "High" } },
    ],
  },
  {
    key: "aiAlarm",
    label: "AI Alarms",
    columns: [
      { key: "alarm", label: "Alarm" },
      { key: "confidence", label: "Confidence" },
    ],
    rows: [
      {
        vehicleId: "vehicle-101",
        cells: { alarm: "Distraction", confidence: "0.82" },
      },
    ],
  },
  {
    key: "driverSwipe",
    label: "Driver",
    columns: [
      { key: "driver", label: "Driver" },
      { key: "swipedAt", label: "Swiped at" },
    ],
    rows: [
      { vehicleId: "vehicle-101", cells: { driver: "A. Gómez", swipedAt: "08:15" } },
    ],
  },
];

export const inMemoryLiveDataSource: LiveDataSource = {
  readLiveState(): LiveState {
    return structuredClone({ fleets, liveVehicles });
  },

  readBottomPanelTabs(): LiveBottomPanelTab[] {
    return structuredClone(bottomPanelTabs);
  },
};
