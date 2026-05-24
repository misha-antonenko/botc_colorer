import Dexie from 'dexie'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, describe, expect, it } from 'vitest'
import { BotcDatabase, type GameRow, type TransactionRow } from './schema'

// Each test gets its own isolated IndexedDB so version-upgrade behaviour is
// reproducible without interfering with the global db singleton.

const DB_NAME = 'botc-coloring'

function idbOptions(factory: IDBFactory) {
  return { indexedDB: factory, IDBKeyRange }
}

function openV1(factory: IDBFactory): Dexie {
  const db = new Dexie(DB_NAME, idbOptions(factory))
  db.version(1).stores({
    games: 'id, updatedAt, createdAt',
    transactions: 'id, gameId, createdAt, kind, enabled',
  })
  return db
}

function openV2(factory: IDBFactory): BotcDatabase {
  return new BotcDatabase(idbOptions(factory))
}

function makeGameRow(overrides: Partial<GameRow> & { playersJSON: string }): GameRow {
  return {
    id: 'g1',
    name: 'Test game',
    createdAt: 100,
    updatedAt: 500,
    blueCountMin: 0,
    blueCountMax: 2,
    ...overrides,
  }
}

describe('DB schema v1 → v2 upgrade', () => {
  const openDbs: Dexie[] = []

  async function setup(factory: IDBFactory, gameRows: GameRow[]): Promise<BotcDatabase> {
    const v1 = openV1(factory)
    openDbs.push(v1)
    await v1.open()
    await v1.table('games').bulkAdd(gameRows)
    v1.close()

    const v2 = openV2(factory)
    openDbs.push(v2)
    await v2.open()
    return v2
  }

  afterEach(() => {
    for (const db of openDbs.splice(0)) {
      db.close()
    }
  })

  it('creates a ColorTx for each player with a fixedColor', async () => {
    const factory = new IDBFactory()
    const gameRow = makeGameRow({
      playersJSON: JSON.stringify([
        { id: 'p1', name: 'Alice', fixedColor: 'blue' },
        { id: 'p2', name: 'Bob', fixedColor: null },
      ]),
    })

    const db = await setup(factory, [gameRow])

    const txRows = await db.transactions.toArray() as TransactionRow[]
    expect(txRows).toHaveLength(1)
    expect(txRows[0]).toMatchObject({
      kind: 'color',
      gameId: 'g1',
      enabled: true,
    })
    const payload = JSON.parse(txRows[0]!.payloadJSON)
    expect(payload).toMatchObject({ playerId: 'p1', color: 'blue' })
  })

  it('creates one transaction per fixed player', async () => {
    const factory = new IDBFactory()
    const gameRow = makeGameRow({
      playersJSON: JSON.stringify([
        { id: 'p1', fixedColor: 'blue' },
        { id: 'p2', fixedColor: 'red' },
        { id: 'p3', fixedColor: null },
      ]),
    })

    const db = await setup(factory, [gameRow])

    const txRows = await db.transactions.toArray() as TransactionRow[]
    expect(txRows).toHaveLength(2)
    const payloads = txRows.map((row) => JSON.parse(row.payloadJSON))
    expect(payloads.find((p: { playerId: string }) => p.playerId === 'p1')).toMatchObject({ color: 'blue' })
    expect(payloads.find((p: { playerId: string }) => p.playerId === 'p2')).toMatchObject({ color: 'red' })
  })

  it('nulls fixedColor on all players after upgrade', async () => {
    const factory = new IDBFactory()
    const gameRow = makeGameRow({
      playersJSON: JSON.stringify([
        { id: 'p1', fixedColor: 'blue' },
        { id: 'p2', fixedColor: null },
      ]),
    })

    const db = await setup(factory, [gameRow])

    const storedGame = await db.games.get('g1')
    const players = JSON.parse(storedGame!.playersJSON) as Array<{ fixedColor: unknown }>
    expect(players.every((p) => p.fixedColor === null)).toBe(true)
  })

  it('handles multiple games independently', async () => {
    const factory = new IDBFactory()
    const gameRows: GameRow[] = [
      makeGameRow({
        id: 'g1',
        updatedAt: 100,
        playersJSON: JSON.stringify([{ id: 'p1', fixedColor: 'red' }]),
      }),
      makeGameRow({
        id: 'g2',
        updatedAt: 200,
        playersJSON: JSON.stringify([{ id: 'p2', fixedColor: 'blue' }]),
      }),
    ]

    const db = await setup(factory, gameRows)

    const txRows = await db.transactions.toArray() as TransactionRow[]
    expect(txRows).toHaveLength(2)
    const p1Tx = txRows.find((row) => row.gameId === 'g1')
    const p2Tx = txRows.find((row) => row.gameId === 'g2')
    expect(JSON.parse(p1Tx!.payloadJSON)).toMatchObject({ color: 'red', createdAt: 100 })
    expect(JSON.parse(p2Tx!.payloadJSON)).toMatchObject({ color: 'blue', createdAt: 200 })
  })

  it('preserves existing transactions', async () => {
    const factory = new IDBFactory()
    const v1 = openV1(factory)
    openDbs.push(v1)
    await v1.open()
    await v1.table('games').add(makeGameRow({
      playersJSON: JSON.stringify([{ id: 'p1', fixedColor: 'blue' }]),
    }))
    await v1.table('transactions').add({
      id: 'tx-existing',
      gameId: 'g1',
      kind: 'dyadic',
      enabled: true,
      createdAt: 50,
      payloadJSON: JSON.stringify({ kind: 'dyadic', active: 'p1', passive: 'p2', weight: 1 }),
    })
    v1.close()

    const v2 = openV2(factory)
    openDbs.push(v2)
    await v2.open()

    const txRows = await v2.transactions.toArray() as TransactionRow[]
    expect(txRows).toHaveLength(2)
    expect(txRows.some((row) => row.id === 'tx-existing')).toBe(true)
    expect(txRows.some((row) => row.kind === 'color')).toBe(true)
  })

  it('produces no transactions when no player has a fixedColor', async () => {
    const factory = new IDBFactory()
    const gameRow = makeGameRow({
      playersJSON: JSON.stringify([
        { id: 'p1', fixedColor: null },
        { id: 'p2', fixedColor: null },
      ]),
    })

    const db = await setup(factory, [gameRow])

    const txRows = await db.transactions.toArray()
    expect(txRows).toHaveLength(0)
  })

  it('is a no-op on an empty database', async () => {
    const factory = new IDBFactory()
    const db = await setup(factory, [])

    expect(await db.games.count()).toBe(0)
    expect(await db.transactions.count()).toBe(0)
  })
})
