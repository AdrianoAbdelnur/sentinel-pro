import type { CatalogLiveInput, LiveState } from "@/application/live";
import type { ProviderConnection, ProviderContribution, Provider } from "@/domain/catalog";
import { createHowenClient } from "@/integrations/howen/client";
import { readHowenConfig } from "@/integrations/howen/config";
import { createHowenOperationalSource } from "@/integrations/howen/howen-operational-source";
import { createHowenSessionManager } from "@/integrations/howen/session";

type Snapshots = CatalogLiveInput["sourceSnapshots"];
type ConnectionSnapshots = Snapshots[string];

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

type OperationalLoader = (contributions: readonly ProviderContribution[]) => Promise<ConnectionSnapshots>;

const operationalLoaders: Readonly<Record<string, OperationalLoader>> = { howen: loadHowenSnapshots };

export async function loadLiveSnapshots(
  connections: readonly ProviderConnection[],
  providers: readonly Provider[],
  contributions: readonly ProviderContribution[],
): Promise<Snapshots> {
  const providersById = new Map(providers.map((provider) => [provider.id, provider]));
  const entries = await Promise.all(connections.map(async (connection) => {
    const load = operationalLoaders[providersById.get(connection.providerId)?.adapterKey ?? ""];
    if (!load) return [connection.id, {}] as const;
    const connectionContributions = contributions.filter(({ connectionId }) => connectionId === connection.id);
    try {
      return [connection.id, await load(connectionContributions)] as const;
    } catch {
      return [connection.id, {}] as const;
    }
  }));
  return Object.fromEntries(entries);
}
