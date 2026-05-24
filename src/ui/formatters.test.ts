import { describe, expect, it } from 'vitest'
import { createColorTxFixture, createGameFixture, createPlayers } from '../test/fixtures'
import { getPlayerCellLabel, summarizeTransaction } from './formatters'

describe('summarizeTransaction (color kind)', () => {
  it('formats a color transaction as "Player is blue"', () => {
    const players = createPlayers(['Alice', 'Bob'])
    const game = createGameFixture({ players })
    const tx = createColorTxFixture({ gameId: game.id, playerId: players[0].id, color: 'blue' })

    expect(summarizeTransaction(game, tx)).toBe('Alice is blue')
  })

  it('formats a color transaction as "Player is red"', () => {
    const players = createPlayers(['Alice', 'Bob'])
    const game = createGameFixture({ players })
    const tx = createColorTxFixture({ gameId: game.id, playerId: players[1].id, color: 'red' })

    expect(summarizeTransaction(game, tx)).toBe('Bob is red')
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
