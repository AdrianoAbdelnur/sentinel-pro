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
  online?: boolean;
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
- `DeviceTelemetry.online` is optional so "the provider sent nothing" is distinguishable from "the provider explicitly reported false". `undefined` MUST NOT be treated as equivalent to `false`.

## Vehicle status rule

`domain/live/vehicle-status.ts` exports a pure function, `resolveVehicleStatus`, that derives a vehicle's live status from its telemetry:

```ts
type VehicleStatus = "en-route" | "stopped" | "offline";

const DEFAULT_STALE_AFTER_MS = 5 * 60 * 1000;

function resolveVehicleStatus(input: {
  telemetry?: DeviceTelemetry;
  nowMs: number;
  staleAfterMs: number;
}): VehicleStatus;
```

Resolution rules:

- Online resolution favors the provider's own flag: `online === true` or `online === false` always wins, even against a stale or fresh timestamp.
- Only when `online` is absent does the staleness fallback apply: the vehicle is online when `nowMs - Date.parse(gpsAt) <= staleAfterMs`, and offline when `gpsAt` is missing, unparsable, or older than the threshold. The comparison is inclusive at the boundary (exactly at the threshold resolves online); the rule is strictly greater-than for offline.
- Status is `en-route` when online and `speedKmH > 0`; `stopped` when online and speed is `0`, absent, negative, or `NaN`; `offline` whenever the vehicle does not resolve online, regardless of speed.
- `nowMs` and `staleAfterMs` are always injected parameters. The function never reads `Date.now()` or `process.env`; resolving `DEFAULT_STALE_AFTER_MS` from configuration is a delivery/composition-root responsibility.

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
