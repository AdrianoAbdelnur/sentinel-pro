import { describe, expect, it } from "vitest";

import {
  BOTTOM_PANEL_COLUMN_COPY,
  BOTTOM_PANEL_EMPTY_STATE_COPY,
  BOTTOM_PANEL_TAB_COPY,
  MAP_EMPTY_STATE_COPY,
  PLAYBACK_NOTICE_COPY,
  VEHICLE_STATUS_COPY,
} from "./live-copy";

const RECORDS: Record<string, Record<string, string>> = {
  MAP_EMPTY_STATE_COPY,
  BOTTOM_PANEL_EMPTY_STATE_COPY,
  PLAYBACK_NOTICE_COPY,
  BOTTOM_PANEL_TAB_COPY,
  BOTTOM_PANEL_COLUMN_COPY,
  VEHICLE_STATUS_COPY,
};

describe("live-copy", () => {
  it.each(Object.entries(RECORDS))(
    "%s has no empty string values",
    (_name, record) => {
      const values = Object.values(record);

      expect(values.length).toBeGreaterThan(0);
      for (const value of values) {
        expect(value.trim().length).toBeGreaterThan(0);
      }
    },
  );

  it("carries the exhaustive set of bottom panel tab keys", () => {
    expect(Object.keys(BOTTOM_PANEL_TAB_COPY).sort()).toEqual(
      ["aiAlarm", "driverSwipe", "event", "normalAlarm", "status"].sort(),
    );
  });

  it("carries the exhaustive set of vehicle status keys", () => {
    expect(Object.keys(VEHICLE_STATUS_COPY).sort()).toEqual(
      ["en-route", "offline", "stopped"].sort(),
    );
  });
});
