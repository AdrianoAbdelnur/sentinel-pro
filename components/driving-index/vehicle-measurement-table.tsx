import type { DrivingIndexVehicleRow } from "@/application/driving-index/contracts";

type VehicleMeasurementTableProps = {
  vehicles: DrivingIndexVehicleRow[];
  realKilometersByPlate: Record<string, string>;
  plannedKilometers: string;
  onRealKilometersChange(canonicalPlate: string, value: string): void;
  onPlannedKilometersChange(value: string): void;
};

export function VehicleMeasurementTable({
  vehicles,
  realKilometersByPlate,
  plannedKilometers,
  onRealKilometersChange,
  onPlannedKilometersChange,
}: VehicleMeasurementTableProps) {
  return (
    <div className="flex flex-col gap-3">
      <label className="flex w-48 flex-col gap-1 text-sm text-zinc-300">
        KP del período
        <input
          type="number"
          value={plannedKilometers}
          onChange={(event) => onPlannedKilometersChange(event.target.value)}
          className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
        />
      </label>
      <table className="w-full text-left text-sm text-zinc-300">
        <thead>
          <tr>
            <th className="border-b border-zinc-800 pb-2 pr-4">Dominio</th>
            <th className="border-b border-zinc-800 pb-2">KR</th>
          </tr>
        </thead>
        <tbody>
          {vehicles.map((vehicle) => (
            <tr key={vehicle.canonicalPlate}>
              <td className="py-2 pr-4">{vehicle.displayPlate}</td>
              <td className="py-2">
                <label className="sr-only" htmlFor={`kr-${vehicle.canonicalPlate}`}>
                  {`KR de ${vehicle.displayPlate}`}
                </label>
                <input
                  id={`kr-${vehicle.canonicalPlate}`}
                  type="number"
                  value={realKilometersByPlate[vehicle.canonicalPlate] ?? ""}
                  onChange={(event) => onRealKilometersChange(vehicle.canonicalPlate, event.target.value)}
                  className="w-28 rounded border border-zinc-700 bg-zinc-950 px-3 py-1.5"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
