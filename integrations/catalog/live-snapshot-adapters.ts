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
  if (result.kind === "failure") throw new Error("Operational source unavailable");
  return mapHowenOperationalStateToCatalogSnapshots(result.state, contributions);
}

export async function loadLiveSnapshots(
  connections: readonly ProviderConnection[],
  providers: readonly Provider[],
  contributions: readonly ProviderContribution[],
): Promise<Snapshots> {
  const providersById = new Map(providers.map((provider) => [provider.id, provider]));
  const entries = await Promise.all(connections.flatMap(async (connection) => {
    const connectionContributions = contributions.filter(({ connectionId }) => connectionId === connection.id);
    if (providersById.get(connection.providerId)?.adapterKey !== "howen") return [];
    return [[connection.id, await loadHowenSnapshots(connectionContributions)] as const];
  }));
  return Object.fromEntries(entries.flat());
}
