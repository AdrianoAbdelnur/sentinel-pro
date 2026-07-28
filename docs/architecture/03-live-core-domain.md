# Live Core Domain

## Goal

Define the normalized internal domain contracts that live features will use regardless of provider origin.

## Operational entities

```ts
type Customer = {
  id: string;
  label: string;
  isActive: boolean;
};

type Fleet = {
  id: string;
  customerId: string;
  label: string;
  isActive: boolean;
};

type Vehicle = {
  id: string;
  customerId: string;
  fleetId: string;
  label: string;
  plate?: string;
  internalCode?: string;
  isActive: boolean;
};

type DeviceOrigin = "howen" | "local" | "other";
type DeviceKind = "mdvr" | "dashcam" | "ipc" | "other";

type Device = {
  id: string;
  vehicleId: string;
  provider: string;
  externalId?: string;
  origin: DeviceOrigin;
  kind: DeviceKind;
  channelCount?: number;
  isActive: boolean;
};

type DeviceTelemetry = {
  deviceId: string;
  online: boolean;
  gpsAt?: string;
  latitude?: number;
  longitude?: number;
  speedKmH?: number;
  headingDeg?: number;
  ignitionOn?: boolean;
  network?: string;
};

type LiveSelectionState = {
  selectedVehicleIds: string[];
  focusedVehicleId?: string;
};
```

## Rules

- `Vehicle` and `Device` are distinct entities.
- Provider raw identifiers MUST NOT become the business domain.
- `origin` and `externalId` exist for traceability, not for UI business logic.
- Telemetry drives map state; playback is a separate capability.

## Operational flow

1. Load customers
2. Load fleets for a customer
3. Load vehicles for a fleet
4. Resolve linked devices
5. Resolve live telemetry
6. Reflect selection in sidebar and map
7. Open playback only after explicit operator action

## Consequence

Any provider adapter must map into these contracts before the UI or page view model consumes the data.
