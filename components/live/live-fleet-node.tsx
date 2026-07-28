import type { LiveFleetNode as LiveFleetNodeViewModel } from "@/application/live";

type LiveFleetNodeProps = {
  fleet: LiveFleetNodeViewModel;
  onToggleExpanded: (fleetId: string) => void;
  onToggleFleet: (fleetId: string) => void;
  onToggleVehicle: (vehicleId: string) => void;
};

export function LiveFleetNode({
  fleet,
  onToggleExpanded,
  onToggleFleet,
  onToggleVehicle,
}: LiveFleetNodeProps) {
  return (
    <li>
      <div className="flex items-center gap-2 px-2 py-1.5">
        <input
          type="checkbox"
          aria-label={`Select all vehicles in ${fleet.label}`}
          checked={fleet.isSelected}
          onChange={() => onToggleFleet(fleet.fleetId)}
          className="size-4 accent-emerald-500"
        />
        <button
          type="button"
          onClick={() => onToggleExpanded(fleet.fleetId)}
          aria-expanded={fleet.isExpanded}
          className="flex flex-1 items-center gap-2 text-left text-sm font-medium text-zinc-100"
        >
          <span
            aria-hidden
            className={`text-xs text-zinc-500 transition-transform ${
              fleet.isExpanded ? "rotate-90" : ""
            }`}
          >
            ▶
          </span>
          {fleet.label}
        </button>
      </div>

      {fleet.isExpanded && (
        <ul className="ml-6 border-l border-zinc-800">
          {fleet.vehicles.map((vehicle) => (
            <li
              key={vehicle.vehicleId}
              className="flex items-center gap-2 py-1 pl-3 pr-2"
            >
              <input
                type="checkbox"
                aria-label={vehicle.label}
                checked={vehicle.isSelected}
                onChange={() => onToggleVehicle(vehicle.vehicleId)}
                className="size-4 accent-emerald-500"
              />
              <span
                aria-hidden
                title={vehicle.isOnline ? "Online" : "Offline"}
                className={`size-2 shrink-0 rounded-full ${
                  vehicle.isOnline ? "bg-emerald-500" : "bg-zinc-600"
                }`}
              />
              <span className="flex-1 truncate text-sm text-zinc-200">
                {vehicle.label}
              </span>
              {vehicle.secondaryLabel && (
                <span className="text-xs text-zinc-500">
                  {vehicle.secondaryLabel}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
