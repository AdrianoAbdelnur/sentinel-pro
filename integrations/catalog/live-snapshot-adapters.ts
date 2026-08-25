import type { CatalogLiveInput, LiveState } from "@/application/live";
import { normalizePlate, type ProviderConnection, type ProviderContribution, type Provider } from "@/domain/catalog";
import { createCybermapaClient } from "@/integrations/cybermapa/client";
import { readCybermapaConfig } from "@/integrations/cybermapa/config";
import { createHowenClient } from "@/integrations/howen/client";
import { readHowenConfig } from "@/integrations/howen/config";
import { createHowenOperationalSource } from "@/integrations/howen/howen-operational-source";
import { createHowenSessionManager } from "@/integrations/howen/session";

type Snapshots = CatalogLiveInput["sourceSnapshots"];
type ConnectionSnapshots = Snapshots[string];

function numberValue(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const result = Number(value);
  return Number.isFinite(result) ? result : undefined;
}

function decodeProviderValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseCybermapaDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  let normalized: string;
  try {
    normalized = decodeURIComponent(value).trim();
  } catch {
    normalized = value.trim();
  }
  const isoDate = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/.exec(normalized);
  if (isoDate) {
    const [, year, month, day, hours, minutes, seconds, milliseconds = "0"] = isoDate;
    const date = new Date(`${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds.padEnd(3, "0")}-03:00`);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }
  const longDate = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/.exec(normalized);
  const shortDate = /^(\d{2})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(normalized);
  const match = longDate ?? shortDate;
  if (!match) return undefined;
  const [, first, second, rawYear, hours, minutes, seconds] = match;
  const isShortMonthFirst = shortDate !== null;
  const day = isShortMonthFirst ? second : first;
  const month = isShortMonthFirst ? first : second;
  const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
  const date = new Date(`${year}-${month}-${day}T${hours}:${minutes}:${seconds}-03:00`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function mapCybermapaCurrentDataToCatalogSnapshots(
  records: readonly import("@/integrations/cybermapa/responses").CybermapaCurrentDataRecord[],
  contributions: readonly ProviderContribution[],
  vehiclePlates: ReadonlyMap<string, string> = new Map(),
): ConnectionSnapshots {
  const recordsByPlate = new Map(records.flatMap((record) => record.patente ? [[normalizePlate(decodeProviderValue(record.patente)), record] as const] : []));
  return Object.fromEntries(contributions.flatMap((contribution) => {
    const plate = vehiclePlates.get(contribution.vehicleId);
    const record = plate ? recordsByPlate.get(normalizePlate(plate)) : undefined;
    if (!record?.gps) return [];
    const latitude = numberValue(record.latitud);
    const longitude = numberValue(record.longitud);
    if (latitude === undefined || longitude === undefined) return [];
    return [[contribution.externalId, {
      telemetry: {
        deviceId: `cybermapa:${record.gps}`,
        gpsAt: parseCybermapaDate(record.fecha),
        latitude,
        longitude,
        speedKmH: numberValue(record.velocidad),
        headingDeg: numberValue(record.sentido),
      },
    }]];
  }));
}

async function loadCybermapaSnapshots(
  contributions: readonly ProviderContribution[],
  vehiclePlates: ReadonlyMap<string, string>,
): Promise<ConnectionSnapshots> {
  const config = readCybermapaConfig();
  const client = createCybermapaClient({ config });
  const plates = contributions.flatMap(({ vehicleId }) => {
    const plate = vehiclePlates.get(vehicleId);
    return plate ? [plate] : [];
  });
  const records = await client.fetchCurrentData(plates, "patente");
  return mapCybermapaCurrentDataToCatalogSnapshots(records, contributions, vehiclePlates);
}

export function mapHowenOperationalStateToCatalogSnapshots(
  state: LiveState,
  contributions: readonly ProviderContribution[],
): ConnectionSnapshots {
  const vehiclesByExternalId = new Map(
    state.liveVehicles.flatMap((vehicle) => vehicle.device?.externalId ? [[vehicle.device.externalId, vehicle] as const] : []),
  );

  return Object.fromEntries(contributions.flatMap((contribution) => {
    const liveVehicle = vehiclesByExternalId.get(contribution.externalId);
    if (!liveVehicle) return [];
    return [[contribution.externalId, {
      ...(liveVehicle.device ? { device: { ...liveVehicle.device, vehicleId: contribution.vehicleId } } : {}),
      ...(liveVehicle.telemetry ? { telemetry: liveVehicle.telemetry } : {}),
    }]];
  }));
}

async function loadHowenSnapshots(contributions: readonly ProviderContribution[]): Promise<ConnectionSnapshots> {
  const config = readHowenConfig();
  const client = createHowenClient({ config, session: createHowenSessionManager({ config }) });
  const result = await createHowenOperationalSource({ client }).loadSnapshot();
  if (result.kind === "failure") return {};
  return mapHowenOperationalStateToCatalogSnapshots(result.state, contributions);
}

type OperationalLoader = (contributions: readonly ProviderContribution[], vehiclePlates: ReadonlyMap<string, string>) => Promise<ConnectionSnapshots>;

const operationalLoaders: Readonly<Record<string, OperationalLoader>> = {
  cybermapa: loadCybermapaSnapshots,
  howen: loadHowenSnapshots,
};

export async function loadLiveSnapshots(
  connections: readonly ProviderConnection[],
  providers: readonly Provider[],
  contributions: readonly ProviderContribution[],
  vehiclePlates: ReadonlyMap<string, string> = new Map(),
): Promise<Snapshots> {
  const providersById = new Map(providers.map((provider) => [provider.id, provider]));
  const entries = await Promise.all(connections.map(async (connection) => {
    const connectionContributions = contributions.filter(({ connectionId }) => connectionId === connection.id);
    if (connectionContributions.length === 0) return undefined;

    const load = operationalLoaders[providersById.get(connection.providerId)?.adapterKey ?? ""];
    if (!load) return [connection.id, {}] as const;
    try {
      return [connection.id, await load(connectionContributions, vehiclePlates)] as const;
    } catch {
      return [connection.id, {}] as const;
    }
  }));
  return Object.fromEntries(entries.filter((entry): entry is Exclude<typeof entry, undefined> => entry !== undefined));
}
