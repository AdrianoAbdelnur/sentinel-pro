const HOWEN_TIME_ZONE = "America/Argentina/Buenos_Aires";
const TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;
const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: HOWEN_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

type DateParts = [number, number, number, number, number, number];

function partsAt(timestamp: number): DateParts {
  const parts = Object.fromEntries(
    formatter
      .formatToParts(new Date(timestamp))
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, Number(value)]),
  );

  return [
    parts.year,
    parts.month,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  ];
}

function asUtc([year, month, day, hour, minute, second]: DateParts): number {
  return Date.UTC(year, month - 1, day, hour, minute, second);
}

function utcParts(timestamp: number): DateParts {
  const date = new Date(timestamp);
  return [
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
  ];
}

export function parseHowenTimestamp(value: string): string | undefined {
  const match = TIMESTAMP_PATTERN.exec(value);
  if (!match) {
    return undefined;
  }

  const expected = match.slice(1).map(Number) as DateParts;
  const localTimestamp = asUtc(expected);
  if (utcParts(localTimestamp).some((part, index) => part !== expected[index])) {
    return undefined;
  }

  let instant = localTimestamp;
  for (let pass = 0; pass < 2; pass += 1) {
    instant += localTimestamp - asUtc(partsAt(instant));
  }

  return partsAt(instant).every((part, index) => part === expected[index])
    ? new Date(instant).toISOString()
    : undefined;
}
