import type {
  OperationalSource,
  OperationalSourceIdentity,
} from "@/application/live";

import type { HowenClient } from "./client";
import { mapHowenRoster } from "./map-howen-roster";
import { HOWEN_PROVIDER } from "./provider";

type CreateHowenOperationalSourceInput = {
  client: HowenClient;
  identity?: OperationalSourceIdentity;
};

const defaultIdentity: OperationalSourceIdentity = {
  id: "howen",
  label: HOWEN_PROVIDER,
};

export function createHowenOperationalSource({
  client,
  identity = defaultIdentity,
}: CreateHowenOperationalSourceInput): OperationalSource {
  return {
    identity,
    async loadSnapshot() {
      try {
        const roster = await client.fetchRoster();
        return { kind: "success", state: mapHowenRoster(roster) };
      } catch {
        return { kind: "failure", code: "unavailable" };
      }
    },
  };
}
