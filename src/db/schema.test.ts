import Dexie from 'dexie'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, describe, expect, it } from 'vitest'
import { BotcDatabase, type GameRow, type TransactionRow } from './schema'

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

function openLatest(factory: IDBFactory): BotcDatabase {
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

describe('DB schema v1 -> v3 upgrade', () => {
  const openDbs: Dexie[] = []

  async function setup(factory: IDBFactory, gameRows: GameRow[], txRows: TransactionRow[] = []): Promise<BotcDatabase> {
    const v1 = openV1(factory)
    openDbs.push(v1)
    await v1.open()
    await v1.table('games').bulkAdd(gameRows)
    if (txRows.length > 0) {
      await v1.table('transactions').bulkAdd(txRows)
    }
    v1.close()

    const latest = openLatest(factory)
    openDbs.push(latest)
    await latest.open()
    return latest
  }

  afterEach(() => {
    for (const db of openDbs.splice(0)) {
      db.close()
    }
  })

  it('converts a fixedColor player to a hard logical transaction', async () => {
    const factory = new IDBFactory()
    const gameRow = makeGameRow({
      playersJSON: JSON.stringify([
        { id: 'p1', name: 'Alice', fixedColor: 'blue' },
        { id: 'p2', name: 'Bob', fixedColor: null },
      ]),
    })

    const db = await setup(factory, [gameRow])

    const txRows = (await db.transactions.toArray()) as TransactionRow[]
    expect(txRows).toHaveLength(1)
    expect(txRows[0]).toMatchObject({
      kind: 'logical',
      gameId: 'g1',
      enabled: true,
    })
    const payload = JSON.parse(txRows[0]!.payloadJSON)
    expect(payload).toMatchObject({ formula: '~Alice', hard: true })
  })

  it('converts fixedColor players from multiple games', async () => {
    const factory = new IDBFactory()
    const gameRows: GameRow[] = [
      makeGameRow({
        id: 'g1',
        updatedAt: 100,
        playersJSON: JSON.stringify([{ id: 'p1', name: 'Alice', fixedColor: 'red' }]),
      }),
      makeGameRow({
        id: 'g2',
        updatedAt: 200,
        playersJSON: JSON.stringify([{ id: 'p2', name: 'Bob', fixedColor: 'blue' }]),
      }),
    ]

    const db = await setup(factory, gameRows)

    const txRows = (await db.transactions.toArray()) as TransactionRow[]
    expect(txRows).toHaveLength(2)
    expect(txRows.every((row) => row.kind === 'logical')).toBe(true)

    const g1Tx = txRows.find((row) => row.gameId === 'g1')
    const g2Tx = txRows.find((row) => row.gameId === 'g2')
    expect(JSON.parse(g1Tx!.payloadJSON)).toMatchObject({ formula: 'Alice', hard: true })
    expect(JSON.parse(g2Tx!.payloadJSON)).toMatchObject({ formula: '~Bob', hard: true })
  })

  it('converts existing dyadic transactions to logical', async () => {
    const factory = new IDBFactory()
    const gameRow = makeGameRow({
      playersJSON: JSON.stringify([
        { id: 'p1', name: 'Alice', fixedColor: null },
        { id: 'p2', name: 'Bob', fixedColor: null },
      ]),
    })

    const dyadicRow: TransactionRow = {
      id: 'tx-d1',
      gameId: 'g1',
      kind: 'dyadic' as 'logical',
      enabled: true,
      createdAt: 50,
      payloadJSON: JSON.stringify({ kind: 'dyadic', active: 'p1', passive: 'p2', weight: 1 }),
    }

    const db = await setup(factory, [gameRow], [dyadicRow])

    const txRows = (await db.transactions.toArray()) as TransactionRow[]
    expect(txRows).toHaveLength(1)
    expect(txRows[0]).toMatchObject({ kind: 'logical' })
    const payload = JSON.parse(txRows[0]!.payloadJSON)
    expect(payload).toMatchObject({ formula: 'Alice = Bob', weight: 1, hard: false })
  })

  it('produces no transactions when no player has a fixedColor and no txs exist', async () => {
    const factory = new IDBFactory()
    const gameRow = makeGameRow({
      playersJSON: JSON.stringify([
        { id: 'p1', name: 'Alice', fixedColor: null },
        { id: 'p2', name: 'Bob', fixedColor: null },
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
