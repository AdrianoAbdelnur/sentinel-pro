import type { OperationalSourceWarning } from "@/application/live";

import { LIVE_SOURCE_WARNING_COPY } from "./live-copy";

type LiveSourceWarningsProps = {
  warnings: OperationalSourceWarning[];
};

export function LiveSourceWarnings({ warnings }: LiveSourceWarningsProps) {
  if (warnings.length === 0) {
    return null;
  }

  return (
    <section
      role="status"
      aria-label="Estado de las fuentes de datos"
      className="shrink-0 border-b border-amber-400/20 bg-amber-400/[0.06] px-4 py-2"
    >
      <ul className="space-y-1">
        {warnings.map((warning) => (
          <li
            key={warning.sourceId}
            className="flex items-center gap-2 text-[12px] text-amber-100/90"
          >
            <span
              aria-hidden
              className="size-1.5 shrink-0 rounded-full bg-amber-400"
            />
            <span>
              {LIVE_SOURCE_WARNING_COPY[warning.code](warning.sourceLabel)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
