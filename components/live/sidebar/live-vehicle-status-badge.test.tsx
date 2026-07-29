import { render, screen } from "@testing-library/react";

import { VEHICLE_STATUS_COPY } from "../live-copy";
import { LiveVehicleStatusBadge } from "./live-vehicle-status-badge";

describe("LiveVehicleStatusBadge", () => {
  it.each(["en-route", "stopped", "offline"] as const)(
    "renders the Spanish word for %s from the shared copy record",
    (status) => {
      render(<LiveVehicleStatusBadge status={status} />);

      expect(screen.getByText(VEHICLE_STATUS_COPY[status])).toBeInTheDocument();
    },
  );
});
