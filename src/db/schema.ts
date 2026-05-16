import Dexie, { type EntityTable } from 'dexie'
import type { ConditionalTx, DyadicTx, Game, Transaction } from '../solver/types'

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

class BotcDatabase extends Dexie {
  games!: EntityTable<GameRow, 'id'>
  transactions!: EntityTable<TransactionRow, 'id'>

  constructor() {
    super('botc-coloring')

    this.version(1).stores({
      games: 'id, updatedAt, createdAt',
      transactions: 'id, gameId, createdAt, kind, enabled',
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
  if (row.kind === 'dyadic') {
    const payload = JSON.parse(row.payloadJSON) as DyadicTx

    return {
      ...payload,
      id: row.id,
      gameId: row.gameId,
      kind: 'dyadic',
      enabled: row.enabled,
      createdAt: row.createdAt,
    }
  }

  const payload = JSON.parse(row.payloadJSON) as ConditionalTx

  return {
    ...payload,
    id: row.id,
    gameId: row.gameId,
    kind: 'conditional',
    enabled: row.enabled,
    createdAt: row.createdAt,
  }
}
