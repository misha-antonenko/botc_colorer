import { describe, expect, it } from 'vitest'
import { CURRENT_VERSION, applyMigrations, buildColorTxesFromPlayers, convertV2TxToLogical } from './migrations'

describe('applyMigrations', () => {
  it('passes through a current-version payload unchanged', () => {
    const payload = {
      version: CURRENT_VERSION,
      exportedAt: 1000,
      games: [],
      transactions: [],
    }

    expect(applyMigrations(payload)).toEqual(payload)
  })

  it('returns non-object input as-is', () => {
    expect(applyMigrations(null)).toBeNull()
    expect(applyMigrations('string')).toBe('string')
    expect(applyMigrations(42)).toBe(42)
  })

  it('passes through a payload whose version exceeds the current version', () => {
    const payload = { version: 999, exportedAt: 1, games: [], transactions: [] }
    expect(applyMigrations(payload)).toEqual(payload)
  })
})

describe('buildColorTxesFromPlayers (shared v1->v2 core)', () => {
  it('returns an empty array when no player has a fixedColor', () => {
    const result = buildColorTxesFromPlayers('g1', 500, [
      { id: 'p1', fixedColor: null },
      { id: 'p2', fixedColor: null },
    ])
    expect(result).toHaveLength(0)
  })

  it('creates one ColorTx per player with a fixedColor', () => {
    const result = buildColorTxesFromPlayers('g1', 500, [
      { id: 'p1', fixedColor: 'blue' },
      { id: 'p2', fixedColor: 'red' },
      { id: 'p3', fixedColor: null },
    ])
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ kind: 'color', gameId: 'g1', createdAt: 500, enabled: true, playerId: 'p1', color: 'blue' })
    expect(result[1]).toMatchObject({ kind: 'color', gameId: 'g1', createdAt: 500, enabled: true, playerId: 'p2', color: 'red' })
  })

  it('assigns each transaction a unique id', () => {
    const result = buildColorTxesFromPlayers('g1', 500, [
      { id: 'p1', fixedColor: 'blue' },
      { id: 'p2', fixedColor: 'blue' },
    ])
    expect(result[0]!.id).not.toBe(result[1]!.id)
  })
})

describe('convertV2TxToLogical', () => {
  const games = [
    {
      id: 'g1',
      players: [
        { id: 'p1', name: 'Alice' },
        { id: 'p2', name: 'Bob' },
        { id: 'p3', name: 'Carol' },
      ],
    },
  ]

  it('converts a positive dyadic tx to an EQ formula', () => {
    const result = convertV2TxToLogical(
      {
        kind: 'dyadic',
        id: 'tx1',
        gameId: 'g1',
        createdAt: 100,
        enabled: true,
        active: 'p1',
        passive: 'p2',
        weight: 2,
      },
      games,
    )

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      kind: 'logical',
      id: 'tx1',
      formula: 'Alice = Bob',
      weight: 2,
      hard: false,
    })
  })

  it('converts a negative dyadic tx to an XOR formula', () => {
    const result = convertV2TxToLogical(
      {
        kind: 'dyadic',
        id: 'tx1',
        gameId: 'g1',
        createdAt: 100,
        enabled: true,
        active: 'p1',
        passive: 'p2',
        weight: -3,
      },
      games,
    )

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      formula: 'Alice ^ Bob',
      weight: 3,
    })
  })

  it('converts a blue color tx to a hard NOT formula', () => {
    const result = convertV2TxToLogical(
      {
        kind: 'color',
        id: 'tx1',
        gameId: 'g1',
        createdAt: 100,
        enabled: true,
        playerId: 'p1',
        color: 'blue',
      },
      games,
    )

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      formula: '~Alice',
      hard: true,
      weight: 1,
    })
  })

  it('converts a red color tx to a hard variable formula', () => {
    const result = convertV2TxToLogical(
      {
        kind: 'color',
        id: 'tx1',
        gameId: 'g1',
        createdAt: 100,
        enabled: true,
        playerId: 'p2',
        color: 'red',
      },
      games,
    )

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      formula: 'Bob',
      hard: true,
    })
  })

  it('converts a conditional tx with one equation to an implication', () => {
    const result = convertV2TxToLogical(
      {
        kind: 'conditional',
        id: 'tx1',
        gameId: 'g1',
        createdAt: 100,
        enabled: true,
        condition: { playerId: 'p1', color: 'blue' },
        equations: [{ i: 'p2', j: 'p3', weight: 1 }],
      },
      games,
    )

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 'tx1',
      formula: '~Alice => (Bob = Carol)',
      weight: 1,
      hard: false,
    })
  })

  it('converts a conditional tx with red condition', () => {
    const result = convertV2TxToLogical(
      {
        kind: 'conditional',
        id: 'tx1',
        gameId: 'g1',
        createdAt: 100,
        enabled: true,
        condition: { playerId: 'p1', color: 'red' },
        equations: [{ i: 'p2', j: 'p3', weight: -1 }],
      },
      games,
    )

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      formula: 'Alice => (Bob ^ Carol)',
      weight: 1,
    })
  })

  it('splits multi-equation conditional into separate logical txs', () => {
    const result = convertV2TxToLogical(
      {
        kind: 'conditional',
        id: 'tx1',
        gameId: 'g1',
        createdAt: 100,
        enabled: true,
        condition: { playerId: 'p1', color: 'blue' },
        equations: [
          { i: 'p2', j: 'p3', weight: 1 },
          { i: 'p1', j: 'p3', weight: -2 },
        ],
      },
      games,
    )

    expect(result).toHaveLength(2)
    expect(result[0]!.id).toBe('tx1')
    expect(result[0]).toMatchObject({ formula: '~Alice => (Bob = Carol)', weight: 1 })
    expect(result[1]).toMatchObject({ formula: '~Alice => (Alice ^ Carol)', weight: 2 })
    expect(result[1]!.id).not.toBe('tx1')
  })

  it('preserves note on all generated txs', () => {
    const result = convertV2TxToLogical(
      {
        kind: 'conditional',
        id: 'tx1',
        gameId: 'g1',
        createdAt: 100,
        enabled: true,
        note: 'test note',
        condition: { playerId: 'p1', color: 'blue' },
        equations: [
          { i: 'p2', j: 'p3', weight: 1 },
          { i: 'p1', j: 'p2', weight: 1 },
        ],
      },
      games,
    )

    expect(result.every((tx) => tx.note === 'test note')).toBe(true)
  })
})

describe('v1 → v3 full migration pipeline', () => {
  it('migrates a v1 payload all the way to v3', () => {
    const v1Payload = {
      version: 1,
      exportedAt: 1000,
      games: [
        {
          id: 'g1',
          name: 'Test game',
          createdAt: 100,
          updatedAt: 200,
          blueCountMin: 0,
          blueCountMax: 2,
          players: [
            { id: 'p1', name: 'Alice', fixedColor: 'blue' },
            { id: 'p2', name: 'Bob', fixedColor: null },
          ],
        },
      ],
      transactions: [
        {
          kind: 'dyadic',
          id: 'tx-d1',
          gameId: 'g1',
          createdAt: 150,
          enabled: true,
          active: 'p1',
          passive: 'p2',
          weight: 1,
        },
      ],
    }

    const result = applyMigrations(v1Payload) as Record<string, unknown>

    expect(result.version).toBe(3)

    const transactions = result.transactions as Array<Record<string, unknown>>
    // Original dyadic + generated color tx from fixedColor
    expect(transactions.length).toBeGreaterThanOrEqual(2)
    expect(transactions.every((tx) => tx['kind'] === 'logical')).toBe(true)

    // The dyadic should become a logical with "Alice = Bob"
    const dyadicConverted = transactions.find((tx) => tx['id'] === 'tx-d1')
    expect(dyadicConverted).toMatchObject({
      kind: 'logical',
      formula: 'Alice = Bob',
      weight: 1,
      hard: false,
    })

    // The color tx should become a hard logical with "~Alice"
    const colorConverted = transactions.find((tx) => tx['formula'] === '~Alice')
    expect(colorConverted).toMatchObject({
      kind: 'logical',
      hard: true,
    })
  })
})

describe('full import pipeline with v1 payload', () => {
  it('parsePortablePayload accepts a v1 payload and migrates it to v3', async () => {
    const { parsePortablePayload } = await import('./portable')

    const v1Payload = {
      version: 1,
      exportedAt: 1000,
      games: [
        {
          id: 'g1',
          name: 'Test game',
          createdAt: 100,
          updatedAt: 200,
          blueCountMin: 0,
          blueCountMax: 2,
          players: [
            { id: 'p1', name: 'Alice', fixedColor: 'blue' },
            { id: 'p2', name: 'Bob', fixedColor: null },
          ],
        },
      ],
      transactions: [],
    }

    const parsed = parsePortablePayload(v1Payload)

    expect(parsed.version).toBe(3)
    expect(parsed.transactions).toHaveLength(1)
    expect(parsed.transactions[0]).toMatchObject({
      kind: 'logical',
      gameId: 'g1',
      formula: '~Alice',
      hard: true,
    })
  })
})
