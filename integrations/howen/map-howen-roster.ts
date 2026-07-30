import type { LiveState, LiveVehicleState } from "@/application/live";
import type { DeviceTelemetry } from "@/domain/live";

import { parseHowenTimestamp } from "./parse-howen-timestamp";
import { HOWEN_PROVIDER } from "./provider";
import type { HowenRosterRecord } from "./responses";

function text(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function number(value: number | string | undefined): number | undefined {
  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }

  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : undefined;
}

function bounded(
  value: number | string | undefined,
  minimum: number,
  maximum: number,
): number | undefined {
  const normalized = number(value);
  return normalized !== undefined &&
    normalized >= minimum &&
    normalized <= maximum
    ? normalized
    : undefined;
}

function telemetry(
  record: HowenRosterRecord,
  deviceId: string,
): DeviceTelemetry {
  const result: DeviceTelemetry = { deviceId };
  const accessMode = number(record.accessmode);
  const latitude = bounded(record.latitude, -90, 90);
  const longitude = bounded(record.longitude, -180, 180);
  const speed = bounded(record.speed, 0, Number.MAX_SAFE_INTEGER);
  const heading = bounded(record.direct, 0, 360);
  const gpsAt = record.dtu ? parseHowenTimestamp(record.dtu) : undefined;

  if (accessMode !== undefined) result.online = accessMode >= 1;
  if (latitude !== undefined) result.latitude = latitude;
  if (longitude !== undefined) result.longitude = longitude;
  if (speed !== undefined) result.speedKmH = speed;
  if (heading !== undefined) result.headingDeg = heading;
  if (gpsAt) result.gpsAt = gpsAt;

  return result;
}

export function mapHowenRoster(records: HowenRosterRecord[]): LiveState {
  const fleets = new Map<string, LiveState["fleets"][number]>();
  const liveVehicles: LiveVehicleState[] = [];
  const deviceNumbers = new Set<string>();

  for (const record of records) {
    const deviceNumber = text(record.deviceno);
    const deviceName = text(record.devicename);
    const externalFleetId = text(record.fleetid);
    const fleetName = text(record.fleetname);
    if (
      !deviceNumber ||
      !deviceName ||
      !externalFleetId ||
      !fleetName ||
      deviceNumbers.has(deviceNumber)
    ) {
      continue;
    }

    deviceNumbers.add(deviceNumber);
    const fleetId = `howen:fleet:${externalFleetId}`;
    const vehicleId = `howen:vehicle:${deviceNumber}`;
    const deviceId = `howen:device:${deviceNumber}`;
    const fleet = fleets.get(fleetId) ?? {
      fleetId,
      label: fleetName,
      vehicleIds: [],
    };
    fleet.vehicleIds.push(vehicleId);
    fleets.set(fleetId, fleet);

    const channelCount = bounded(
      record.videoencodernumber,
      0,
      Number.MAX_SAFE_INTEGER,
    );
    liveVehicles.push({
      vehicle: {
        id: vehicleId,
        fleetId,
        plate: deviceName,
        isActive: true,
      },
      device: {
        id: deviceId,
        vehicleId,
        provider: HOWEN_PROVIDER,
        externalId: deviceNumber,
        origin: "howen",
        kind: "mdvr",
        ...(Number.isInteger(channelCount) ? { channelCount } : {}),
        isActive: true,
      },
      telemetry: telemetry(record, deviceId),
    });
  }

  return { fleets: [...fleets.values()], liveVehicles };
}
