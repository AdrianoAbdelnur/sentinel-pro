import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import LivePage from "./page";

const ENV_VAR = "SENTINEL_LIVE_STALE_AFTER_MS";

describe("LivePage runtime configuration", () => {
  const originalValue = process.env[ENV_VAR];

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env[ENV_VAR];
    } else {
      process.env[ENV_VAR] = originalValue;
    }
  });

  it("injects a valid staleness override into composed vehicle status", () => {
    process.env[ENV_VAR] = "600000";

    render(<LivePage />);

    expect(
      screen.getByLabelText("2 de 2 vehículos en línea"),
    ).toBeInTheDocument();
  });
});
