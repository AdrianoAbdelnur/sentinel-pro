type LiveProviderBadgeProps = {
  provider?: string;
};

// The only place provider identity touches the UI. Keep it that way, and keep
// every provider on the same monochrome style: per-provider colours would put
// provider identity into the visual language, which
// docs/architecture/02-provider-agnostic-live-principles.md forbids.
export function LiveProviderBadge({ provider }: LiveProviderBadgeProps) {
  if (!provider) {
    return null;
  }

  return (
    <span className="rounded-sm bg-slate-800/60 px-1.5 py-px font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">
      {provider}
    </span>
  );
}
