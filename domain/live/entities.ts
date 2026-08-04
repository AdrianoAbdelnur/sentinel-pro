export type Fleet = {
  id: string;
  label: string;
  isActive: boolean;
};

export type Vehicle = {
  id: string;
  fleetId: string;
  label?: string;
  plate?: string;
  internalCode?: string;
  isActive: boolean;
};

export type DeviceOrigin = "howen" | "local" | "other";
export type DeviceKind = "mdvr" | "dashcam" | "ipc" | "other";

export type Device = {
  id: string;
  vehicleId: string;
  provider: string;
  externalId?: string;
  origin: DeviceOrigin;
  kind: DeviceKind;
  channelCount?: number;
  isActive: boolean;
};

export type DeviceTelemetry = {
  deviceId: string;
  online?: boolean;
  gpsAt?: string;
  latitude?: number;
  longitude?: number;
  speedKmH?: number;
  headingDeg?: number;
  ignitionOn?: boolean;
  network?: string;
};

export type LiveSelectionState = {
  selectedVehicleIds: string[];
  focusedVehicleId?: string;
};
