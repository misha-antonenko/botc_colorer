import { describe, expect, it } from 'vitest'
import { CURRENT_VERSION, applyMigrations } from './migrations'

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
    // A payload from a future version of the app should be returned as-is
    // rather than throwing, so users get a schema parse error with context.
    const payload = { version: 999, exportedAt: 1, games: [], transactions: [] }
    expect(applyMigrations(payload)).toEqual(payload)
  })
})

describe('v1 → v2 migration', () => {
  function makeV1Payload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      version: 1,
      exportedAt: 1000,
      games: [],
      transactions: [],
      ...overrides,
    }
  }

  it('bumps the version to 2', () => {
    const result = applyMigrations(makeV1Payload()) as Record<string, unknown>
    expect(result.version).toBe(2)
  })

  it('converts a player fixedColor to a ColorTx transaction', () => {
    const payload = makeV1Payload({
      games: [
        {
          id: 'g1',
          updatedAt: 5000,
          players: [
            { id: 'p1', name: 'Alice', fixedColor: 'blue' },
            { id: 'p2', name: 'Bob', fixedColor: null },
          ],
        },
      ],
    })

    const result = applyMigrations(payload) as Record<string, unknown>
    const transactions = result.transactions as Record<string, unknown>[]

    expect(transactions).toHaveLength(1)
    expect(transactions[0]).toMatchObject({
      kind: 'color',
      gameId: 'g1',
      createdAt: 5000,
      enabled: true,
      playerId: 'p1',
      color: 'blue',
    })
    expect(typeof transactions[0]!.id).toBe('string')
  })

  it('generates one transaction per fixed player, one per color', () => {
    const payload = makeV1Payload({
      games: [
        {
          id: 'g1',
          updatedAt: 5000,
          players: [
            { id: 'p1', fixedColor: 'blue' },
            { id: 'p2', fixedColor: 'red' },
            { id: 'p3', fixedColor: null },
          ],
        },
      ],
    })

    const result = applyMigrations(payload) as Record<string, unknown>
    const transactions = result.transactions as Record<string, unknown>[]

    expect(transactions).toHaveLength(2)
    expect(transactions.find((tx) => tx['playerId'] === 'p1')).toMatchObject({ color: 'blue' })
    expect(transactions.find((tx) => tx['playerId'] === 'p2')).toMatchObject({ color: 'red' })
  })

  it('nulls fixedColor on all players after migration', () => {
    const payload = makeV1Payload({
      games: [
        {
          id: 'g1',
          updatedAt: 5000,
          players: [
            { id: 'p1', fixedColor: 'blue' },
            { id: 'p2', fixedColor: null },
          ],
        },
      ],
    })

    const result = applyMigrations(payload) as Record<string, unknown>
    const games = result.games as Array<{ players: Array<{ fixedColor: unknown }> }>

    for (const player of games[0]!.players) {
      expect(player.fixedColor).toBeNull()
    }
  })

  it('preserves existing transactions alongside the new color ones', () => {
    const existingTx = {
      id: 'tx-existing',
      kind: 'dyadic',
      gameId: 'g1',
      createdAt: 100,
      enabled: true,
      active: 'p1',
      passive: 'p2',
      weight: 1,
    }

    const payload = makeV1Payload({
      games: [
        {
          id: 'g1',
          updatedAt: 5000,
          players: [
            { id: 'p1', fixedColor: 'blue' },
            { id: 'p2', fixedColor: null },
          ],
        },
      ],
      transactions: [existingTx],
    })

    const result = applyMigrations(payload) as Record<string, unknown>
    const transactions = result.transactions as Record<string, unknown>[]

    expect(transactions).toHaveLength(2)
    expect(transactions).toContainEqual(existingTx)
    expect(transactions.find((tx) => tx['kind'] === 'color')).toBeDefined()
  })

  it('handles multiple games independently', () => {
    const payload = makeV1Payload({
      games: [
        {
          id: 'g1',
          updatedAt: 1000,
          players: [{ id: 'p1', fixedColor: 'red' }],
        },
        {
          id: 'g2',
          updatedAt: 2000,
          players: [{ id: 'p2', fixedColor: 'blue' }],
        },
      ],
    })

    const result = applyMigrations(payload) as Record<string, unknown>
    const transactions = result.transactions as Record<string, unknown>[]

    expect(transactions).toHaveLength(2)
    expect(transactions.find((tx) => tx['gameId'] === 'g1')).toMatchObject({
      color: 'red',
      createdAt: 1000,
    })
    expect(transactions.find((tx) => tx['gameId'] === 'g2')).toMatchObject({
      color: 'blue',
      createdAt: 2000,
    })
  })

  it('produces no transactions when no player has a fixedColor', () => {
    const payload = makeV1Payload({
      games: [
        {
          id: 'g1',
          updatedAt: 5000,
          players: [
            { id: 'p1', fixedColor: null },
            { id: 'p2', fixedColor: null },
          ],
        },
      ],
    })

    const result = applyMigrations(payload) as Record<string, unknown>
    expect(result.transactions).toEqual([])
  })
})

describe('full import pipeline with v1 payload', () => {
  it('parsePortablePayload accepts a v1 payload and migrates it', async () => {
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

    expect(parsed.version).toBe(2)
    expect(parsed.transactions).toHaveLength(1)
    expect(parsed.transactions[0]).toMatchObject({
      kind: 'color',
      gameId: 'g1',
      playerId: 'p1',
      color: 'blue',
    })
    // fixedColor cleared on players
    expect(parsed.games[0]!.players[0]!.fixedColor).toBeNull()
  })
})
