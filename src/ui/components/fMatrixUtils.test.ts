import { describe, expect, it } from 'vitest'
import { createConditionalTxFixture, createGameFixture, createPlayers } from '../../test/fixtures'
import { buildStateMatrixData, formatMatrixCellValue } from './fMatrixUtils'

describe('buildStateMatrixData', () => {
  it('shows the symmetric conditional range in both directed cells', () => {
    const players = createPlayers(['Alice', 'Bob', 'Carol'])
    const game = createGameFixture({ players })
    const transactions = [
      createConditionalTxFixture({
        id: 'tx-1',
        gameId: game.id,
        condition: { playerId: players[0].id, color: 'blue' },
        equations: [{ i: players[1].id, j: players[2].id, weight: 1 }],
      }),
      createConditionalTxFixture({
        id: 'tx-2',
        gameId: game.id,
        condition: { playerId: players[0].id, color: 'red' },
        equations: [{ i: players[2].id, j: players[1].id, weight: -0.5 }],
      }),
    ]

    const matrix = buildStateMatrixData(game, transactions)

    expect(matrix.conditionalRanges[1][2]).toEqual({ lo: -0.5, hi: 1 })
    expect(matrix.conditionalRanges[2][1]).toEqual({ lo: -0.5, hi: 1 })
    expect(matrix.conditionalRanges[0][1]).toBeNull()
  })

  it('omits the range annotation when both endpoints are zero', () => {
    expect(formatMatrixCellValue(0, { lo: 0, hi: 0 })).toBe('0')
    expect(formatMatrixCellValue(2, { lo: -0.5, hi: 1 })).toBe('2 + [-0.5, 1]')
  })
})
