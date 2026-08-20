const MONTH_LABELS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

type ReportPeriodPickerProps = {
  month: number | null;
  year: number | null;
  onMonthChange(month: number): void;
  onYearChange(year: number): void;
};

export function ReportPeriodPicker({ month, year, onMonthChange, onYearChange }: ReportPeriodPickerProps) {
  return (
    <fieldset className="flex flex-wrap items-end gap-4">
      <legend className="mb-2 text-sm font-medium text-zinc-300">Período del reporte</legend>
      <label className="flex flex-col gap-1 text-sm text-zinc-300">
        Mes
        <select
          value={month ?? ""}
          onChange={(event) => onMonthChange(Number(event.target.value))}
          className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
        >
          <option value="" disabled>
            Elegí un mes
          </option>
          {MONTH_LABELS.map((label, index) => (
            <option key={label} value={index + 1}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm text-zinc-300">
        Año
        <input
          type="number"
          value={year ?? ""}
          onChange={(event) => onYearChange(Number(event.target.value))}
          className="w-28 rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
        />
      </label>
    </fieldset>
  );
}
