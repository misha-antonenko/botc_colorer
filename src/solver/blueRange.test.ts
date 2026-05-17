import { describe, expect, it } from 'vitest'
import { getBlueRangeStepDelta, shiftBlueRangeWithPlayerCount } from './blueRange'

describe('getBlueRangeStepDelta', () => {
  it('follows the standard BotC good-player step pattern', () => {
    expect(getBlueRangeStepDelta(5, 6)).toBe(1)
    expect(getBlueRangeStepDelta(6, 7)).toBe(1)
    expect(getBlueRangeStepDelta(7, 8)).toBe(1)
    expect(getBlueRangeStepDelta(8, 9)).toBe(1)
    expect(getBlueRangeStepDelta(9, 10)).toBe(0)
    expect(getBlueRangeStepDelta(10, 11)).toBe(1)
    expect(getBlueRangeStepDelta(11, 12)).toBe(1)
    expect(getBlueRangeStepDelta(12, 13)).toBe(0)

    expect(getBlueRangeStepDelta(7, 6)).toBe(-1)
    expect(getBlueRangeStepDelta(8, 7)).toBe(-1)
    expect(getBlueRangeStepDelta(10, 9)).toBe(0)
  })
})

describe('shiftBlueRangeWithPlayerCount', () => {
  it('shifts both boundaries by the mapped delta', () => {
    expect(shiftBlueRangeWithPlayerCount(3, 4, 6, 7)).toEqual({ min: 4, max: 5 })
    expect(shiftBlueRangeWithPlayerCount(4, 6, 7, 8)).toEqual({ min: 5, max: 7 })
    expect(shiftBlueRangeWithPlayerCount(2, 5, 9, 10)).toEqual({ min: 2, max: 5 })
    expect(shiftBlueRangeWithPlayerCount(2, 5, 10, 9)).toEqual({ min: 2, max: 5 })
  })

  it('clamps shifted boundaries to the new player count', () => {
    expect(shiftBlueRangeWithPlayerCount(0, 5, 5, 6)).toEqual({ min: 1, max: 6 })
    expect(shiftBlueRangeWithPlayerCount(8, 9, 13, 12)).toEqual({ min: 8, max: 9 })
    expect(shiftBlueRangeWithPlayerCount(0, 5, 12, 11)).toEqual({ min: 0, max: 4 })
  })
})
