import { describe, expect, it } from 'vitest'
import { buildColoringContributionBreakdown, solveGame } from './solve'
import { createColorTxFixture, createConditionalTxFixture, createDyadicTxFixture, createGameFixture, createPlayers } from '../test/fixtures'

describe('solveGame', () => {
  it('ranks a single dyadic transaction correctly', () => {
    const players = createPlayers(['Alice', 'Bob'])
    const game = createGameFixture({ players, blueCountMax: 2 })
    const transaction = createDyadicTxFixture({
      active: players[0].id,
      passive: players[1].id,
      weight: 1,
      gameId: game.id,
    })

    const results = solveGame(game, [transaction])

    expect(results).toEqual([
      { c: 3, fitness: 1 },
      { c: 0, fitness: 1 },
      { c: 1, fitness: -1 },
      { c: 2, fitness: -1 },
    ])
  })

  it('cancels opposing dyadic directions on the same pair', () => {
    const players = createPlayers(['Alice', 'Bob'])
    const game = createGameFixture({ players, blueCountMax: 2 })
    const transactions = [
      createDyadicTxFixture({
        id: 'tx-1',
        active: players[0].id,
        passive: players[1].id,
        weight: 1,
        gameId: game.id,
      }),
      createDyadicTxFixture({
        id: 'tx-2',
        active: players[1].id,
        passive: players[0].id,
        weight: -1,
        gameId: game.id,
      }),
    ]

    const results = solveGame(game, transactions)

    expect(results).toEqual([
      { c: 3, fitness: 0 },
      { c: 1, fitness: 0 },
      { c: 2, fitness: 0 },
      { c: 0, fitness: 0 },
    ])
  })

  it('adds zero contribution when a conditional is unmet', () => {
    const players = createPlayers(['Alice', 'Bob', 'Carol'])
    const game = createGameFixture({ players })
    const transaction = createConditionalTxFixture({
      gameId: game.id,
      condition: { playerId: players[0].id, color: 'blue' },
      equations: [{ i: players[1].id, j: players[2].id, weight: 1 }],
    })

    const results = solveGame(game, [transaction])

    expect(results.find((result) => result.c === 4)?.fitness).toBe(0)
  })

  it('adds the expected contribution when a conditional is met', () => {
    const players = createPlayers(['Alice', 'Bob', 'Carol'])
    const game = createGameFixture({ players })
    const transaction = createConditionalTxFixture({
      gameId: game.id,
      condition: { playerId: players[0].id, color: 'blue' },
      equations: [{ i: players[1].id, j: players[2].id, weight: 1 }],
    })

    const results = solveGame(game, [transaction])

    expect(results.find((result) => result.c === 7)?.fitness).toBe(1)
    expect(results.find((result) => result.c === 5)?.fitness).toBe(-1)
  })

  it('treats negative weights as inequality preferences', () => {
    const players = createPlayers(['Alice', 'Bob'])
    const game = createGameFixture({ players, blueCountMax: 2 })
    const transaction = createDyadicTxFixture({
      active: players[0].id,
      passive: players[1].id,
      weight: -1,
      gameId: game.id,
    })

    const results = solveGame(game, [transaction])

    expect(results).toEqual([
      { c: 1, fitness: 1 },
      { c: 2, fitness: 1 },
      { c: 3, fitness: -1 },
      { c: 0, fitness: -1 },
    ])
  })

  it('prunes fixed colors from color transactions', () => {
    const players = createPlayers(['Alice', 'Bob'])
    const game = createGameFixture({ players, blueCountMax: 2 })
    const colorTx = createColorTxFixture({
      gameId: game.id,
      playerId: players[0].id,
      color: 'blue',
    })

    const results = solveGame(game, [colorTx])

    expect(results).toEqual([
      { c: 3, fitness: 0 },
      { c: 1, fitness: 0 },
    ])
  })

  it('prunes fixed red from color transactions', () => {
    const players = createPlayers(['Alice', 'Bob'])
    const game = createGameFixture({ players, blueCountMax: 2 })
    const colorTx = createColorTxFixture({
      gameId: game.id,
      playerId: players[0].id,
      color: 'red',
    })

    const results = solveGame(game, [colorTx])

    expect(results).toEqual([
      { c: 2, fitness: 0 },
      { c: 0, fitness: 0 },
    ])
  })

  it('uses the latest color transaction when multiple target the same player', () => {
    const players = createPlayers(['Alice', 'Bob'])
    const game = createGameFixture({ players, blueCountMax: 2 })
    const olderTx = createColorTxFixture({
      id: 'tx-older',
      gameId: game.id,
      playerId: players[0].id,
      color: 'red',
      createdAt: 100,
    })
    const newerTx = createColorTxFixture({
      id: 'tx-newer',
      gameId: game.id,
      playerId: players[0].id,
      color: 'blue',
      createdAt: 200,
    })

    // Newer says blue — only colorings with Alice blue should survive.
    const results = solveGame(game, [olderTx, newerTx])

    expect(results).toEqual([
      { c: 3, fitness: 0 },
      { c: 1, fitness: 0 },
    ])
  })

  it('ignores disabled color transactions', () => {
    const players = createPlayers(['Alice', 'Bob'])
    const game = createGameFixture({ players, blueCountMax: 2 })
    const colorTx = createColorTxFixture({
      gameId: game.id,
      playerId: players[0].id,
      color: 'blue',
      enabled: false,
    })

    // Disabled — all 4 colorings survive.
    const results = solveGame(game, [colorTx])

    expect(results).toHaveLength(4)
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

  it('sums fractional weights exactly in deterministic cases', () => {
    const players = createPlayers(['Alice', 'Bob', 'Carol'])
    const game = createGameFixture({ players })
    const transactions = [
      createDyadicTxFixture({
        id: 'tx-1',
        active: players[0].id,
        passive: players[1].id,
        weight: 0.5,
        gameId: game.id,
      }),
      createConditionalTxFixture({
        id: 'tx-2',
        gameId: game.id,
        condition: { playerId: players[2].id, color: 'blue' },
        equations: [{ i: players[0].id, j: players[1].id, weight: 0.25 }],
      }),
    ]

    const results = solveGame(game, transactions)

    expect(results.find((result) => result.c === 7)?.fitness).toBe(0.75)
  })

  it('uses the documented lexicographic tiebreaker', () => {
    const players = createPlayers(['Alice', 'Bob'])
    const game = createGameFixture({ players, blueCountMax: 2 })

    const results = solveGame(game, [])

    expect(results.map((result) => result.c)).toEqual([3, 1, 2, 0])
  })
})

describe('buildColoringContributionBreakdown', () => {
  it('marks negative dyadic equations satisfied only when colors differ', () => {
    const players = createPlayers(['Alice', 'Bob'])
    const game = createGameFixture({ players, blueCountMax: 2 })
    const transaction = createDyadicTxFixture({
      id: 'tx-negative-dyadic',
      active: players[0].id,
      passive: players[1].id,
      weight: -1,
      gameId: game.id,
    })

    const satisfiedBreakdown = buildColoringContributionBreakdown(game, [transaction], 1)
    const unsatisfiedBreakdown = buildColoringContributionBreakdown(game, [transaction], 3)

    expect(satisfiedBreakdown).toEqual([
      expect.objectContaining({
        satisfied: true,
        contribution: 1,
      }),
    ])
    expect(unsatisfiedBreakdown).toEqual([
      expect.objectContaining({
        satisfied: false,
        contribution: -1,
      }),
    ])
  })

  it('marks negative conditional equations satisfied only when colors differ', () => {
    const players = createPlayers(['Alice', 'Bob', 'Carol'])
    const game = createGameFixture({ players })
    const transaction = createConditionalTxFixture({
      id: 'tx-negative-conditional',
      gameId: game.id,
      condition: { playerId: players[0].id, color: 'blue' },
      equations: [{ i: players[1].id, j: players[2].id, weight: -2 }],
    })

    const satisfiedBreakdown = buildColoringContributionBreakdown(game, [transaction], 5)
    const unsatisfiedBreakdown = buildColoringContributionBreakdown(game, [transaction], 7)

    expect(satisfiedBreakdown).toEqual([
      expect.objectContaining({
        satisfied: true,
        contribution: 2,
      }),
    ])
    expect(unsatisfiedBreakdown).toEqual([
      expect.objectContaining({
        satisfied: false,
        contribution: -2,
      }),
    ])
  })
})
