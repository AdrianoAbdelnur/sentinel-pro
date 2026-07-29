const REPORT_LOCALE = "es-AR";

// Pinned, not defaulted: `Intl`'s runtime locale and time zone can differ
// between the Node server render and the browser, which would desync hydration.
// Multi-tenant time zones would replace this constant.
const REPORT_TIME_ZONE = "America/Argentina/Buenos_Aires";

const timeFormatter = new Intl.DateTimeFormat(REPORT_LOCALE, {
  timeZone: REPORT_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  // Not `hour12: false` — that leaves the hour cycle implementation-defined and
  // can render midnight as "24:mm" on some ICU builds.
  hourCycle: "h23",
});

const titleFormatter = new Intl.DateTimeFormat(REPORT_LOCALE, {
  timeZone: REPORT_TIME_ZONE,
  dateStyle: "medium",
  timeStyle: "medium",
});

/** Absolute `HH:mm`, in the fixed locale/time zone above. */
export function formatLastReportTime(iso: string): string {
  return timeFormatter.format(new Date(iso));
}

/** Full local date and time, for the `<time>` element's `title`. */
export function formatLastReportTitle(iso: string): string {
  return titleFormatter.format(new Date(iso));
}
