import { describe, expect, it } from 'vitest'
import { createGameFixture, createLogicalTxFixture, createPlayers } from '../test/fixtures'
import { getPlayerCellLabel, summarizeTransaction } from './formatters'

describe('summarizeTransaction', () => {
  it('formats a soft logical transaction', () => {
    const players = createPlayers(['Alice', 'Bob'])
    const game = createGameFixture({ players })
    const tx = createLogicalTxFixture({ formula: 'Al ^ Bob', weight: 2, gameId: game.id })

    expect(summarizeTransaction(game, tx)).toBe('Al ^ Bob, w = +2')
  })

  it('formats a hard logical transaction', () => {
    const players = createPlayers(['Alice', 'Bob'])
    const game = createGameFixture({ players })
    const tx = createLogicalTxFixture({ formula: '~Alice', weight: 1, hard: true, gameId: game.id })

    expect(summarizeTransaction(game, tx)).toBe('~Alice [hard]')
  })

  it('hides weight when it is 1', () => {
    const players = createPlayers(['Alice', 'Bob'])
    const game = createGameFixture({ players })
    const tx = createLogicalTxFixture({ formula: 'Al', weight: 1, gameId: game.id })

    expect(summarizeTransaction(game, tx)).toBe('Al')
  })
})

describe('getPlayerCellLabel', () => {
  it('returns the first three visible characters of a player name', () => {
    expect(getPlayerCellLabel('Alice')).toBe('Ali')
    expect(getPlayerCellLabel('Mary Jane')).toBe('Mar')
    expect(getPlayerCellLabel('Mo')).toBe('Mo')
    expect(getPlayerCellLabel('')).toBe('?')
  })
})
