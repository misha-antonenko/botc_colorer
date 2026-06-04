import { describe, expect, it } from 'vitest'
import { buildColoringContributionBreakdown, solveGame } from './solve'
import { createGameFixture, createLogicalTxFixture, createPlayers } from '../test/fixtures'

describe('solveGame', () => {
  it('ranks same-color formula correctly', () => {
    const players = createPlayers(['Alice', 'Bob'])
    const game = createGameFixture({ players, blueCountMax: 2 })
    const tx = createLogicalTxFixture({
      formula: 'Al = Bob',
      weight: 1,
      gameId: game.id,
    })

    const results = solveGame(game, [tx])

    // same color (0b00=both blue, 0b11=both red) → +1; different → -1
    expect(results).toEqual([
      { c: 3, fitness: 1 },
      { c: 0, fitness: 1 },
      { c: 1, fitness: -1 },
      { c: 2, fitness: -1 },
    ])
  })

  it('ranks different-color formula correctly', () => {
    const players = createPlayers(['Alice', 'Bob'])
    const game = createGameFixture({ players, blueCountMax: 2 })
    const tx = createLogicalTxFixture({
      formula: 'Al ^ Bob',
      weight: 1,
      gameId: game.id,
    })

    const results = solveGame(game, [tx])

    expect(results).toEqual([
      { c: 1, fitness: 1 },
      { c: 2, fitness: 1 },
      { c: 3, fitness: -1 },
      { c: 0, fitness: -1 },
    ])
  })

  it('soft formulas cancel when weights oppose', () => {
    const players = createPlayers(['Alice', 'Bob'])
    const game = createGameFixture({ players, blueCountMax: 2 })
    const txs = [
      createLogicalTxFixture({
        id: 'tx-1',
        formula: 'Al = Bob',
        weight: 1,
        gameId: game.id,
      }),
      createLogicalTxFixture({
        id: 'tx-2',
        formula: 'Al ^ Bob',
        weight: 1,
        gameId: game.id,
      }),
    ]

    const results = solveGame(game, txs)

    expect(results.every((r) => r.fitness === 0)).toBe(true)
  })

  it('hard constraint prunes colorings', () => {
    const players = createPlayers(['Alice', 'Bob'])
    const game = createGameFixture({ players, blueCountMax: 2 })
    // Alice is blue → ~Alice (NOT red)
    const tx = createLogicalTxFixture({
      formula: '~Alice',
      hard: true,
      gameId: game.id,
    })

    const results = solveGame(game, [tx])

    // Only colorings where Alice is blue (bit 0 = 0): 0b00 and 0b10
    expect(results.map((r) => r.c).sort()).toEqual([0, 2])
  })

  it('hard constraint for red prunes correctly', () => {
    const players = createPlayers(['Alice', 'Bob'])
    const game = createGameFixture({ players, blueCountMax: 2 })
    const tx = createLogicalTxFixture({
      formula: 'Alice',
      hard: true,
      gameId: game.id,
    })

    const results = solveGame(game, [tx])

    // Only colorings where Alice is red (bit 0 = 1): 0b01 and 0b11
    expect(results.map((r) => r.c).sort()).toEqual([1, 3])
  })

  it('implication formula works', () => {
    const players = createPlayers(['Alice', 'Bob', 'Carol'])
    const game = createGameFixture({ players })
    // If Alice is blue, then Bob = Carol (same color)
    // ~Alice => (Bob = Carol)
    const tx = createLogicalTxFixture({
      formula: '~Al => (Bob = C)',
      weight: 1,
      gameId: game.id,
    })

    const results = solveGame(game, [tx])

    // When Alice is red (bit0=1), formula is vacuously true → +1
    // When Alice is blue (bit0=0), formula depends on Bob = Carol
    //   Bob=Carol → +1, Bob!=Carol → -1
    const aliceRedResults = results.filter((r) => (r.c & 1) === 1)
    expect(aliceRedResults.every((r) => r.fitness === 1)).toBe(true)
  })

  it('prunes by the blue range', () => {
    const players = createPlayers(['Alice', 'Bob', 'Carol'])
    const game = createGameFixture({
      players,
      blueCountMin: 1,
      blueCountMax: 1,
    })

    const results = solveGame(game, [])

    expect(results.map((result) => result.c)).toEqual([1, 2, 4])
  })

  it('sums fractional weights', () => {
    const players = createPlayers(['Alice', 'Bob'])
    const game = createGameFixture({ players, blueCountMax: 2 })
    const txs = [
      createLogicalTxFixture({
        id: 'tx-1',
        formula: 'Al = Bob',
        weight: 0.5,
        gameId: game.id,
      }),
      createLogicalTxFixture({
        id: 'tx-2',
        formula: 'Al = Bob',
        weight: 0.25,
        gameId: game.id,
      }),
    ]

    const results = solveGame(game, txs)

    expect(results.find((r) => r.c === 0)?.fitness).toBe(0.75)
  })

  it('uses the documented lexicographic tiebreaker', () => {
    const players = createPlayers(['Alice', 'Bob'])
    const game = createGameFixture({ players, blueCountMax: 2 })

    const results = solveGame(game, [])

    expect(results.map((result) => result.c)).toEqual([3, 1, 2, 0])
  })

  it('ignores disabled transactions', () => {
    const players = createPlayers(['Alice', 'Bob'])
    const game = createGameFixture({ players, blueCountMax: 2 })
    const tx = createLogicalTxFixture({
      formula: '~Alice',
      hard: true,
      enabled: false,
      gameId: game.id,
    })

    const results = solveGame(game, [tx])

    expect(results).toHaveLength(4)
  })

  it('combines hard and soft constraints', () => {
    const players = createPlayers(['Alice', 'Bob'])
    const game = createGameFixture({ players, blueCountMax: 2 })
    const hardTx = createLogicalTxFixture({
      id: 'hard',
      formula: '~Alice',
      hard: true,
      gameId: game.id,
    })
    const softTx = createLogicalTxFixture({
      id: 'soft',
      formula: 'Bob',
      weight: 2,
      gameId: game.id,
    })

    const results = solveGame(game, [hardTx, softTx])

    // Alice must be blue → only c=0 (both blue) and c=2 (Bob red)
    // c=2: Bob is red → satisfied → +2
    // c=0: Bob is blue → unsatisfied → -2
    expect(results).toEqual([
      { c: 2, fitness: 2 },
      { c: 0, fitness: -2 },
    ])
  })
})

describe('buildColoringContributionBreakdown', () => {
  it('shows hard constraint as satisfied with zero contribution', () => {
    const players = createPlayers(['Alice', 'Bob'])
    const game = createGameFixture({ players, blueCountMax: 2 })
    const tx = createLogicalTxFixture({
      id: 'tx-hard',
      formula: '~Alice',
      hard: true,
      gameId: game.id,
    })

    // coloring 0 = both blue, Alice is blue → satisfied
    const breakdown = buildColoringContributionBreakdown(game, [tx], 0)

    expect(breakdown).toEqual([
      expect.objectContaining({
        sourceTxId: 'tx-hard',
        hard: true,
        satisfied: true,
        contribution: 0,
      }),
    ])
  })

  it('shows soft constraint contribution', () => {
    const players = createPlayers(['Alice', 'Bob'])
    const game = createGameFixture({ players, blueCountMax: 2 })
    const tx = createLogicalTxFixture({
      id: 'tx-soft',
      formula: 'Al ^ Bob',
      weight: 3,
      gameId: game.id,
    })

    // coloring 1 = Alice red, Bob blue → different → satisfied
    const satisfied = buildColoringContributionBreakdown(game, [tx], 1)
    expect(satisfied[0].contribution).toBe(3)
    expect(satisfied[0].satisfied).toBe(true)

    // coloring 3 = both red → same → unsatisfied
    const unsatisfied = buildColoringContributionBreakdown(game, [tx], 3)
    expect(unsatisfied[0].contribution).toBe(-3)
    expect(unsatisfied[0].satisfied).toBe(false)
  })
})
