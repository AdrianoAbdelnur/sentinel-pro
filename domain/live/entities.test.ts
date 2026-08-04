import { describe, expectTypeOf, it } from "vitest";

import type { Fleet, Vehicle } from "./entities";

// @ts-expect-error Customer ownership is intentionally outside the live core.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { Customer } from "./entities";

describe("live core entities", () => {
  it("keeps customer ownership outside fleet and vehicle contracts", () => {
    expectTypeOf<Fleet>().toEqualTypeOf<{
      id: string;
      label: string;
      isActive: boolean;
    }>();

    expectTypeOf<Vehicle>().toEqualTypeOf<{
      id: string;
      fleetId: string;
      label?: string;
      plate?: string;
      internalCode?: string;
      isActive: boolean;
    }>();
  });
});
