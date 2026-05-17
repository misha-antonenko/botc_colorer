const STANDARD_BLUE_COUNTS: Record<number, number> = {
  5: 3,
  6: 4,
  7: 5,
  8: 5,
  9: 6,
  10: 7,
  11: 7,
  12: 8,
  13: 9,
  14: 9,
  15: 10,
}

function clamp(value: number, max: number): number {
  return Math.max(0, Math.min(value, max))
}

export function getStandardBlueCount(playerCount: number): number | null {
  return STANDARD_BLUE_COUNTS[playerCount] ?? null
}

export function getBlueRangeStepDelta(previousPlayerCount: number, nextPlayerCount: number): number {
  const previousBlueCount = getStandardBlueCount(previousPlayerCount)
  const nextBlueCount = getStandardBlueCount(nextPlayerCount)

  if (previousBlueCount === null || nextBlueCount === null) {
    return 0
  }

  return nextBlueCount - previousBlueCount
}

export function shiftBlueRangeWithPlayerCount(
  min: number,
  max: number,
  previousPlayerCount: number,
  nextPlayerCount: number,
): { min: number; max: number } {
  const delta = getBlueRangeStepDelta(previousPlayerCount, nextPlayerCount)
  const nextMin = clamp(min + delta, nextPlayerCount)
  const nextMax = clamp(max + delta, nextPlayerCount)

  return {
    min: Math.min(nextMin, nextMax),
    max: Math.max(nextMin, nextMax),
  }
}
