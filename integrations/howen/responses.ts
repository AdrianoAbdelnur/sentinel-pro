export type HowenRosterRecord = {
  deviceno?: string;
  devicename?: string;
  fleetid?: string;
  fleetname?: string;
  accessmode?: number | string;
  videoencodernumber?: number | string;
  longitude?: number | string;
  latitude?: number | string;
  speed?: number | string;
  direct?: number | string;
  dtu?: string;
};

const stringFields = [
  "deviceno",
  "devicename",
  "fleetid",
  "fleetname",
  "dtu",
] as const;
const numericFields = [
  "accessmode",
  "videoencodernumber",
  "longitude",
  "latitude",
  "speed",
  "direct",
] as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRecord(value: unknown): HowenRosterRecord | undefined {
  if (!isObject(value)) {
    return undefined;
  }

  const record: HowenRosterRecord = {};

  for (const field of stringFields) {
    if (typeof value[field] === "string") {
      record[field] = value[field];
    }
  }

  for (const field of numericFields) {
    const candidate = value[field];
    if (typeof candidate === "number" || typeof candidate === "string") {
      record[field] = candidate;
    }
  }

  return record;
}

export function parseHowenRosterResponse(value: unknown): HowenRosterRecord[] {
  if (
    !isObject(value) ||
    value.status !== 10000 ||
    !isObject(value.data) ||
    !Array.isArray(value.data.dataList)
  ) {
    throw new Error("Invalid Howen roster response");
  }

  const records = value.data.dataList.flatMap((item) => {
    const record = parseRecord(item);
    return record ? [record] : [];
  });
  Object.defineProperty(records, "receivedRecordCount", { value: value.data.dataList.length });
  return records;
}
