type LiveProviderBadgeProps = {
  provider?: string;
};

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
