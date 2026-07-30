import { describe, expect, it } from "vitest";

import {
  createLiveMapClusterIcon,
  createLiveMapVehicleIcon,
} from "./live-map-icons";

describe("createLiveMapVehicleIcon", () => {
  it("exposes the vehicle label and heading without provider styling", () => {
    const icon = createLiveMapVehicleIcon({
      vehicleId: "vehicle-101",
      label: "Unit 101",
      latitude: -34.6037,
      longitude: -58.3816,
      headingDeg: 90,
    });

    expect(icon.options.html).toContain('aria-label="Unit 101"');
    expect(icon.options.html).toContain("--marker-rotation:90deg");
    expect(icon.options.html).not.toMatch(/howen|praxsys|hikvision/i);
  });

  it("escapes labels and leaves an absent heading unrotated", () => {
    const icon = createLiveMapVehicleIcon({
      vehicleId: "vehicle-201",
      label: 'Unit <201> "north"',
      latitude: -34.9011,
      longitude: -56.1645,
    });

    expect(icon.options.html).toContain(
      'aria-label="Unit &lt;201&gt; &quot;north&quot;"',
    );
    expect(icon.options.html).not.toContain("--marker-rotation:");
  });
});

describe("createLiveMapClusterIcon", () => {
  it("exposes an accessible Spanish count", () => {
    const icon = createLiveMapClusterIcon(17);

    expect(icon.options.html).toContain(
      'aria-label="Grupo de 17 vehículos"',
    );
    expect(icon.options.html).toContain(">17<");
  });
});
