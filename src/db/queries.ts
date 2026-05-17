import { useLiveQuery } from 'dexie-react-hooks'
import type { Game, GameId, Player, Transaction } from '../solver/types'
import type { GameSnapshot } from './backup'
import { snapshotGameState } from './backup'
import { db, decodeGameRow, decodeTransactionRow, encodeGameRow, encodeTransactionRow } from './schema'

function createDefaultPlayer(index: number): Player {
  return {
    id: crypto.randomUUID(),
    name: `Player ${index + 1}`,
    fixedColor: null,
  }
}

function touchGame(game: Game): Game {
  return {
    ...game,
    updatedAt: Date.now(),
  }
}

export function createDefaultGame(): Game {
  const now = Date.now()

  return {
    id: crypto.randomUUID(),
    name: 'New game',
    createdAt: now,
    updatedAt: now,
    blueCountMin: 9,
    blueCountMax: 9,
    players: Array.from({ length: 12 }, (_, index) => createDefaultPlayer(index)),
  }
}

async function getGameOrThrow(gameId: GameId): Promise<Game> {
  const row = await db.games.get(gameId)

  if (row === undefined) {
    throw new Error(`Missing game: ${gameId}`)
  }

  return decodeGameRow(row)
}

export function useGames(): Game[] | undefined {
  return useLiveQuery(
    async () => {
      const rows = await db.games.orderBy('updatedAt').reverse().toArray()
      return rows.map(decodeGameRow)
    },
    [],
    undefined,
  )
}

export function useGame(gameId: GameId | undefined): Game | null | undefined {
  return useLiveQuery(
    async () => {
      if (gameId === undefined) {
        return null
      }

      const row = await db.games.get(gameId)
      return row === undefined ? null : decodeGameRow(row)
    },
    [gameId],
    undefined,
  )
}

export function useTransactions(gameId: GameId | undefined): Transaction[] | undefined {
  return useLiveQuery(
    async () => {
      if (gameId === undefined) {
        return undefined
      }

      const rows = await db.transactions.where('gameId').equals(gameId).sortBy('createdAt')
      return rows.map(decodeTransactionRow).sort((left, right) => right.createdAt - left.createdAt)
    },
    [gameId],
    undefined,
  )
}

export function useAllTransactions(): Transaction[] | undefined {
  return useLiveQuery(
    async () => {
      const rows = await db.transactions.toArray()
      return rows.map(decodeTransactionRow)
    },
    [],
    undefined,
  )
}

export async function createGame(): Promise<Game> {
  const game = createDefaultGame()
  await db.games.put(encodeGameRow(game))
  await snapshotGameState(game.id)
  return game
}

export async function saveGame(game: Game): Promise<Game> {
  const nextGame = touchGame(game)
  await db.games.put(encodeGameRow(nextGame))
  await snapshotGameState(nextGame.id)
  return nextGame
}

export async function duplicateGame(gameId: GameId): Promise<Game> {
  const sourceGame = await getGameOrThrow(gameId)
  const now = Date.now()
  const duplicate: Game = {
    ...sourceGame,
    id: crypto.randomUUID(),
    name: `${sourceGame.name} (copy)`,
    createdAt: now,
    updatedAt: now,
    players: sourceGame.players.map((player) => ({
      ...player,
      id: crypto.randomUUID(),
      fixedColor: null,
    })),
  }

  await db.games.put(encodeGameRow(duplicate))
  await snapshotGameState(duplicate.id)
  return duplicate
}

export async function saveTransaction(transaction: Transaction): Promise<Transaction> {
  await db.transaction('rw', db.games, db.transactions, async () => {
    await db.transactions.put(encodeTransactionRow(transaction))
    const game = await getGameOrThrow(transaction.gameId)
    await db.games.put(encodeGameRow(touchGame(game)))
  })
  await snapshotGameState(transaction.gameId)
  return transaction
}

export async function toggleTransaction(
  transaction: Transaction,
  enabled: boolean,
): Promise<Transaction> {
  const nextTransaction: Transaction = {
    ...transaction,
    enabled,
  }

  return saveTransaction(nextTransaction)
}

export async function deleteTransaction(transactionId: string): Promise<Transaction | null> {
  const row = await db.transactions.get(transactionId)

  if (row === undefined) {
    return null
  }

  const transaction = decodeTransactionRow(row)

  await db.transaction('rw', db.games, db.transactions, async () => {
    await db.transactions.delete(transactionId)
    const game = await getGameOrThrow(transaction.gameId)
    await db.games.put(encodeGameRow(touchGame(game)))
  })
  await snapshotGameState(transaction.gameId)
  return transaction
}

export async function restoreGameSnapshot(snapshot: GameSnapshot): Promise<void> {
  await db.transaction('rw', db.games, db.transactions, async () => {
    await db.games.put(encodeGameRow(snapshot.game))
    await db.transactions.where('gameId').equals(snapshot.game.id).delete()
    await db.transactions.bulkPut(snapshot.transactions.map(encodeTransactionRow))
  })
  await snapshotGameState(snapshot.game.id)
}
