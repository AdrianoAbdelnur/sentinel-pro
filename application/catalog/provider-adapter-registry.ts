export type ProviderAdapterRegistry<TConnection, TSource> = {
  register(adapterKey: string, factory: (connection: TConnection) => TSource | undefined): void;
  has(adapterKey: string): boolean;
  resolve(adapterKey: string, connection: TConnection): TSource | undefined;
};

export function createProviderAdapterRegistry<TConnection, TSource>(): ProviderAdapterRegistry<TConnection, TSource> {
  const factories = new Map<string, (connection: TConnection) => TSource | undefined>();
  return {
    register(adapterKey, factory) { factories.set(adapterKey, factory); },
    has(adapterKey) { return factories.has(adapterKey); },
    resolve(adapterKey, connection) { return factories.get(adapterKey)?.(connection); },
  };
}
