import { describe, expect, it } from 'vitest'
import { getPlayerCellLabel } from './formatters'

describe('getPlayerCellLabel', () => {
  it('returns the first three visible characters of a player name', () => {
    expect(getPlayerCellLabel('Alice')).toBe('Ali')
    expect(getPlayerCellLabel('Mary Jane')).toBe('Mar')
    expect(getPlayerCellLabel('Mo')).toBe('Mo')
    expect(getPlayerCellLabel('')).toBe('?')
  })
})
