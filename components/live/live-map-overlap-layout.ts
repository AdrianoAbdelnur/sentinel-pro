export type LiveMapOverlapOffset = {
  readonly vehicleId: string;
  readonly offsetX: number;
  readonly offsetY: number;
};

const FIRST_RING_CAPACITY = 8;
const RING_RADIUS_PX = 28;
const START_ANGLE_RADIANS = -Math.PI / 2;

export function buildDeterministicOverlapLayout(
  vehicleIds: readonly string[],
): LiveMapOverlapOffset[] {
  const sortedVehicleIds = [...vehicleIds].sort(compareVehicleIds);
  let ring = 1;
  let ringStart = 0;
  let ringCapacity = FIRST_RING_CAPACITY;

  return sortedVehicleIds.map((vehicleId, index) => {
    while (index >= ringStart + ringCapacity) {
      ringStart += ringCapacity;
      ring += 1;
      ringCapacity = FIRST_RING_CAPACITY * ring;
    }

    const indexInRing = index - ringStart;
    const angle =
      START_ANGLE_RADIANS +
      (indexInRing / ringCapacity) * Math.PI * 2;
    const radius = RING_RADIUS_PX * ring;

    return {
      vehicleId,
      offsetX: Math.cos(angle) * radius,
      offsetY: Math.sin(angle) * radius,
    };
  });
}

function compareVehicleIds(left: string, right: string): number {
  if (left === right) {
    return 0;
  }

  return left < right ? -1 : 1;
}
