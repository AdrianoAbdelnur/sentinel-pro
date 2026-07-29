type CollapseDirection = "left" | "right" | "up" | "down";

const CHEVRON_ROTATION: Record<CollapseDirection, string> = {
  left: "rotate-180",
  right: "",
  up: "-rotate-90",
  down: "rotate-90",
};

type CollapseToggleProps = {
  label: string;
  direction: CollapseDirection;
  onClick: () => void;
  expanded: boolean;
};

export function CollapseToggle({
  label,
  direction,
  onClick,
  expanded,
}: CollapseToggleProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={expanded}
      onClick={onClick}
      className="flex size-6 shrink-0 items-center justify-center rounded text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50"
    >
      <svg
        aria-hidden
        viewBox="0 0 8 8"
        className={`size-2.5 fill-current transition-transform ${CHEVRON_ROTATION[direction]}`}
      >
        <path d="M2 0 L7 4 L2 8 Z" />
      </svg>
    </button>
  );
}
