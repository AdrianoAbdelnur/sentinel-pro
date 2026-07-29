const REPORT_LOCALE = "es-AR";
const REPORT_TIME_ZONE = "America/Argentina/Buenos_Aires";

const timeFormatter = new Intl.DateTimeFormat(REPORT_LOCALE, {
  timeZone: REPORT_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const titleFormatter = new Intl.DateTimeFormat(REPORT_LOCALE, {
  timeZone: REPORT_TIME_ZONE,
  dateStyle: "medium",
  timeStyle: "medium",
});

export function formatLastReportTime(iso: string): string {
  return timeFormatter.format(new Date(iso));
}

export function formatLastReportTitle(iso: string): string {
  return titleFormatter.format(new Date(iso));
}
