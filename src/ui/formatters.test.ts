import { describe, expect, it } from 'vitest'
import { getNameInitials } from './formatters'

describe('getNameInitials', () => {
  it('returns one or two initials from a player name', () => {
    expect(getNameInitials('Alice')).toBe('A')
    expect(getNameInitials('Mary Jane')).toBe('MJ')
    expect(getNameInitials('')).toBe('?')
  })
})
