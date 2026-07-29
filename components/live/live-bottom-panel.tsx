import type { LiveBottomPanelTab, LiveBottomPanelViewModel } from "@/application/live";

import { CollapseToggle } from "./collapse-toggle";
import {
  BOTTOM_PANEL_COLUMN_COPY,
  BOTTOM_PANEL_EMPTY_STATE_COPY,
  BOTTOM_PANEL_TAB_COPY,
} from "./live-copy";

const MISSING_VALUE = "—";

export const COLLAPSE_BOTTOM_PANEL_LABEL = "Contraer panel de datos";
export const EXPAND_BOTTOM_PANEL_LABEL = "Expandir panel de datos";

type LiveBottomPanelProps = {
  bottomPanel: LiveBottomPanelViewModel;
  vehicleLabels: Record<string, string>;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  onTabChange: (tab: LiveBottomPanelTab["key"]) => void;
};

export function LiveBottomPanel({
  bottomPanel,
  vehicleLabels,
  isCollapsed,
  onToggleCollapsed,
  onTabChange,
}: LiveBottomPanelProps) {
  const activeTab = bottomPanel.tabs.find(
    (tab) => tab.key === bottomPanel.activeTab,
  );

  return (
    <section className="flex min-h-0 flex-col border-t border-slate-800 bg-slate-950">
      <div className="flex shrink-0 items-center border-b border-slate-800 pr-2">
        <div role="tablist" className="flex flex-1 gap-0.5 px-2 pt-1.5">
          {bottomPanel.tabs.map((tab) => {
            const isActive = tab.key === bottomPanel.activeTab;

            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onTabChange(tab.key)}
                className={`-mb-px border-b-2 px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40 ${
                  isActive
                    ? "border-sky-400 text-sky-200"
                    : "border-transparent text-slate-500 hover:text-slate-300"
                }`}
              >
                {BOTTOM_PANEL_TAB_COPY[tab.key]}
              </button>
            );
          })}
        </div>

        <CollapseToggle
          label={
            isCollapsed
              ? EXPAND_BOTTOM_PANEL_LABEL
              : COLLAPSE_BOTTOM_PANEL_LABEL
          }
          direction={isCollapsed ? "up" : "down"}
          expanded={!isCollapsed}
          onClick={onToggleCollapsed}
        />
      </div>

      {!isCollapsed && (
      <div className="min-h-0 flex-1 overflow-auto">
        {bottomPanel.emptyState ? (
          <p className="px-4 py-6 text-[13px] text-slate-600">
            {BOTTOM_PANEL_EMPTY_STATE_COPY[bottomPanel.emptyState.code]}
          </p>
        ) : (
          activeTab && (
            <table className="w-full text-left text-[13px]">
              <thead className="sticky top-0 bg-slate-950 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">
                <tr className="border-b border-slate-800">
                  <th scope="col" className="px-4 py-2 font-semibold">
                    Vehículo
                  </th>
                  {activeTab.columns.map((column) => (
                    <th
                      key={column.key}
                      scope="col"
                      className="px-4 py-2 font-semibold"
                    >
                      {BOTTOM_PANEL_COLUMN_COPY[column.key] ?? column.key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeTab.rows.map((row) => (
                  <tr
                    key={row.vehicleId}
                    className="border-b border-slate-800/50 transition-colors last:border-b-0 hover:bg-white/[0.02]"
                  >
                    <th
                      scope="row"
                      className="px-4 py-2 font-mono text-[12px] font-medium uppercase tracking-wide text-slate-200"
                    >
                      {vehicleLabels[row.vehicleId] ?? row.vehicleId}
                    </th>
                    {activeTab.columns.map((column) => (
                      <td
                        key={column.key}
                        className="px-4 py-2 font-mono tabular-nums text-slate-400"
                      >
                        {formatCell(row.cells[column.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>
      )}
    </section>
  );
}

function formatCell(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined) {
    return MISSING_VALUE;
  }

  if (typeof value === "boolean") {
    return value ? "Sí" : "No";
  }

  return String(value);
}
