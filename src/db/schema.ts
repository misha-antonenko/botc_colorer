import Dexie, { type EntityTable } from 'dexie'
import type { Game, LogicalTx, Transaction } from '../solver/types'
import { buildColorTxesFromPlayers, convertV2TxToLogical, type V1Player } from './migrations'

export interface GameRow {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  blueCountMin: number
  blueCountMax: number
  playersJSON: string
}

export interface TransactionRow {
  id: string
  gameId: string
  kind: Transaction['kind']
  enabled: boolean
  createdAt: number
  payloadJSON: string
}

export class BotcDatabase extends Dexie {
  games!: EntityTable<GameRow, 'id'>
  transactions!: EntityTable<TransactionRow, 'id'>

  constructor(options?: ConstructorParameters<typeof Dexie>[1]) {
    super('botc-coloring', options)

    this.version(1).stores({
      games: 'id, updatedAt, createdAt',
      transactions: 'id, gameId, createdAt, kind, enabled',
    })

    this.version(2).upgrade(async (trans) => {
      const gameRows = (await trans.table('games').toArray()) as GameRow[]

      for (const gameRow of gameRows) {
        const players = JSON.parse(gameRow.playersJSON) as V1Player[]
        const colorTxes = buildColorTxesFromPlayers(gameRow.id, gameRow.updatedAt, players)

        if (colorTxes.length === 0) {
          continue
        }

        await trans.table('transactions').bulkAdd(colorTxes.map((tx) => ({
          id: tx.id,
          gameId: tx.gameId,
          kind: tx.kind,
          enabled: tx.enabled,
          createdAt: tx.createdAt,
          payloadJSON: JSON.stringify(tx),
        })))

        const nulledPlayers = players.map((player) => ({ ...player, fixedColor: null }))
        await trans
          .table('games')
          .update(gameRow.id, { playersJSON: JSON.stringify(nulledPlayers) })
      }
    })

    this.version(3).upgrade(async (trans) => {
      const gameRows = (await trans.table('games').toArray()) as GameRow[]
      const games = gameRows.map((row) => ({
        id: row.id,
        players: JSON.parse(row.playersJSON) as Array<{ id: string; name: string }>,
      }))

      const txRows = (await trans.table('transactions').toArray()) as TransactionRow[]
      const deleteIds: string[] = []
      const addRows: TransactionRow[] = []

      for (const row of txRows) {
        const payload = JSON.parse(row.payloadJSON)
        const v2Tx = { ...payload, id: row.id, gameId: row.gameId, kind: row.kind, enabled: row.enabled, createdAt: row.createdAt }
        const logicalTxs = convertV2TxToLogical(v2Tx, games)

        deleteIds.push(row.id)
        for (const ltx of logicalTxs) {
          addRows.push(encodeTransactionRow(ltx))
        }
      }

      await trans.table('transactions').bulkDelete(deleteIds)
      await trans.table('transactions').bulkAdd(addRows)
    })
  }
}

export const db = new BotcDatabase()

export function encodeGameRow(game: Game): GameRow {
  return {
    id: game.id,
    name: game.name,
    createdAt: game.createdAt,
    updatedAt: game.updatedAt,
    blueCountMin: game.blueCountMin,
    blueCountMax: game.blueCountMax,
    playersJSON: JSON.stringify(game.players),
  }
}

export function decodeGameRow(row: GameRow): Game {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    blueCountMin: row.blueCountMin,
    blueCountMax: row.blueCountMax,
    players: JSON.parse(row.playersJSON) as Game['players'],
  }
}

export function encodeTransactionRow(transaction: Transaction): TransactionRow {
  return {
    id: transaction.id,
    gameId: transaction.gameId,
    kind: transaction.kind,
    enabled: transaction.enabled,
    createdAt: transaction.createdAt,
    payloadJSON: JSON.stringify(transaction),
  }
}

export function decodeTransactionRow(row: TransactionRow): Transaction {
  const payload = JSON.parse(row.payloadJSON) as LogicalTx

  return {
    ...payload,
    id: row.id,
    gameId: row.gameId,
    kind: 'logical',
    enabled: row.enabled,
    createdAt: row.createdAt,
  }
}
