import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  client: {},
  database: {},
  getMongoClient: vi.fn(),
  getMongoDatabase: vi.fn(),
  initializeCatalogDatabase: vi.fn(),
  createCatalogRepositories: vi.fn(),
  createSynchronizeConnectionApplication: vi.fn(),
  createCatalogBootstrapApplication: vi.fn(),
  createCatalogSyncSourceRegistry: vi.fn(),
  registerAdapters: vi.fn(),
}));

vi.mock("@/integrations/persistence/mongodb", () => ({
  getMongoClient: mocks.getMongoClient,
  getMongoDatabase: mocks.getMongoDatabase,
  initializeCatalogDatabase: mocks.initializeCatalogDatabase,
  createCatalogRepositories: mocks.createCatalogRepositories,
  MongoCatalogTransactionRunner: vi.fn(),
}));
vi.mock("@/application/catalog/synchronize-connection", () => ({ createSynchronizeConnectionApplication: mocks.createSynchronizeConnectionApplication }));
vi.mock("@/application/catalog/bootstrap-catalog", () => ({
  CATALOG_ADAPTER_REGISTRATIONS: [
    { adapterKey: "cybermapa", capabilities: ["gps", "operationalAlerts"], credentialRef: "env:cybermapa", cadenceMinutes: 60 },
    { adapterKey: "howen", capabilities: ["gps", "video", "videoAlerts"], credentialRef: "env:howen", cadenceMinutes: 60 },
  ],
  createCatalogBootstrapApplication: mocks.createCatalogBootstrapApplication,
}));
vi.mock("@/integrations/catalog/sync-source-adapters", () => ({ createCatalogSyncSourceRegistry: mocks.createCatalogSyncSourceRegistry }));

describe("provider import runtime composition", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.getMongoClient.mockResolvedValue(mocks.client);
    mocks.getMongoDatabase.mockResolvedValue(mocks.database);
    mocks.initializeCatalogDatabase.mockResolvedValue(undefined);
    mocks.createCatalogRepositories.mockReturnValue({ connections: {}, providers: {}, syncRuns: {}, syncLeases: {} });
    mocks.createSynchronizeConnectionApplication.mockReturnValue({ synchronize: vi.fn() });
    mocks.createCatalogSyncSourceRegistry.mockReturnValue({ resolve: vi.fn() });
    mocks.createCatalogBootstrapApplication.mockReturnValue({ registerAdapters: mocks.registerAdapters });
    mocks.registerAdapters.mockResolvedValue({ registered: 2, reused: 0 });
  });

  it("initializes Mongo and registers the existing adapters before exposing the runtime", async () => {
    const { getProviderImportRuntime } = await import("./composition");

    await getProviderImportRuntime();

    expect(mocks.initializeCatalogDatabase).toHaveBeenCalledWith(mocks.database);
    expect(mocks.createCatalogBootstrapApplication).toHaveBeenCalled();
    expect(mocks.registerAdapters).toHaveBeenCalledWith([
      expect.objectContaining({ adapterKey: "cybermapa" }),
      expect.objectContaining({ adapterKey: "howen" }),
    ]);
  });

  it("shares one in-flight bootstrap across repeated runtime requests", async () => {
    const { getProviderImportRuntime } = await import("./composition");

    const runtimes = await Promise.all([getProviderImportRuntime(), getProviderImportRuntime(), getProviderImportRuntime()]);

    expect(runtimes[0]).toBe(runtimes[1]);
    expect(runtimes[1]).toBe(runtimes[2]);
    expect(mocks.initializeCatalogDatabase).toHaveBeenCalledOnce();
    expect(mocks.registerAdapters).toHaveBeenCalledOnce();
  });
});
