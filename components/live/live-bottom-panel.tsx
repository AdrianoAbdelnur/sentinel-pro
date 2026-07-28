import type { LiveBottomPanelTab, LiveBottomPanelViewModel } from "@/application/live";

const MISSING_VALUE = "—";

type LiveBottomPanelProps = {
  bottomPanel: LiveBottomPanelViewModel;
  vehicleLabels: Record<string, string>;
  onTabChange: (tab: LiveBottomPanelTab["key"]) => void;
};

export function LiveBottomPanel({
  bottomPanel,
  vehicleLabels,
  onTabChange,
}: LiveBottomPanelProps) {
  const activeTab = bottomPanel.tabs.find(
    (tab) => tab.key === bottomPanel.activeTab,
  );

  return (
    <section className="flex min-h-0 flex-col border-t border-zinc-800 bg-zinc-950">
      <div role="tablist" className="flex shrink-0 gap-1 px-3 pt-2">
        {bottomPanel.tabs.map((tab) => {
          const isActive = tab.key === bottomPanel.activeTab;

          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onTabChange(tab.key)}
              className={`rounded-t-md px-3 py-1.5 text-sm transition-colors ${
                isActive
                  ? "bg-zinc-900 text-zinc-50"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-zinc-900">
        {bottomPanel.emptyState ? (
          <p className="px-4 py-6 text-sm text-zinc-400">
            {bottomPanel.emptyState.message}
          </p>
        ) : (
          activeTab && (
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-zinc-900 text-xs uppercase tracking-wide text-zinc-400">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Vehicle
                  </th>
                  {activeTab.columns.map((column) => (
                    <th
                      key={column.key}
                      scope="col"
                      className="px-4 py-2 font-medium"
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeTab.rows.map((row) => (
                  <tr key={row.vehicleId} className="border-t border-zinc-800">
                    <th
                      scope="row"
                      className="px-4 py-2 font-normal text-zinc-100"
                    >
                      {vehicleLabels[row.vehicleId] ?? row.vehicleId}
                    </th>
                    {activeTab.columns.map((column) => (
                      <td key={column.key} className="px-4 py-2 text-zinc-300">
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
    </section>
  );
}

function formatCell(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined) {
    return MISSING_VALUE;
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return String(value);
}
