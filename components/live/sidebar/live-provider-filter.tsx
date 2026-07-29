export const ALL_PROVIDERS_LABEL = "Todos los proveedores";
export const ALL_PROVIDERS_VALUE = "all";

type LiveProviderFilterProps = {
  provider?: string;
  availableProviders: string[];
  onProviderChange: (provider: string | undefined) => void;
};

export function LiveProviderFilter({
  provider,
  availableProviders,
  onProviderChange,
}: LiveProviderFilterProps) {
  return (
    <select
      aria-label="Proveedor"
      value={provider ?? ALL_PROVIDERS_VALUE}
      onChange={(event) => {
        const value = event.target.value;
        onProviderChange(value === ALL_PROVIDERS_VALUE ? undefined : value);
      }}
      className="w-full cursor-pointer rounded-md border border-slate-800 bg-slate-900/70 px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-wide text-slate-300 transition-colors focus:border-sky-500/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40"
    >
      <option value={ALL_PROVIDERS_VALUE}>{ALL_PROVIDERS_LABEL}</option>
      {availableProviders.map((availableProvider) => (
        <option key={availableProvider} value={availableProvider}>
          {availableProvider.toUpperCase()}
        </option>
      ))}
    </select>
  );
}
