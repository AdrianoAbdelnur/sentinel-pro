import type { CapabilitySourceStatus } from "./capabilities";

export type DeviceStatus = "active" | "inactive";

export type CatalogDevice = Readonly<{
  id: string;
  vehicleId: string;
  connectionId: string;
  deviceId: string;
  kind?: string;
  make?: string;
  model?: string;
  status?: DeviceStatus;
  capabilities: Readonly<Record<string, CapabilitySourceStatus>>;
  presence: "present" | "absent";
}>;

export type CatalogDeviceInput = Omit<CatalogDevice, "capabilities"> & { capabilities?: Record<string, CapabilitySourceStatus> };

export function createCatalogDevice(input: CatalogDeviceInput): CatalogDevice {
  return Object.freeze({ ...input, capabilities: Object.freeze({ ...(input.capabilities ?? {}) }) });
}
