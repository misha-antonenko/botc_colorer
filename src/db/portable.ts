import { z } from 'zod'
import type { Game, PortableImportResult, PortablePayload, Transaction } from '../solver/types'
import { CURRENT_VERSION, applyMigrations } from './migrations'
import { db, decodeGameRow, decodeTransactionRow, encodeGameRow, encodeTransactionRow } from './schema'

const nonZeroNumber = z.number().finite().refine((value) => value !== 0, {
  message: 'Expected a nonzero number',
})

const playerSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
})

const gameSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  createdAt: z.number().finite(),
  updatedAt: z.number().finite(),
  blueCountMin: z.number().int(),
  blueCountMax: z.number().int(),
  players: z.array(playerSchema).min(1).max(16),
})

const baseTxSchema = z.object({
  id: z.string().min(1),
  gameId: z.string().min(1),
  createdAt: z.number().finite(),
  enabled: z.boolean(),
  note: z.string().optional(),
})

const logicalSchema = baseTxSchema.extend({
  kind: z.literal('logical'),
  formula: z.string().min(1),
  weight: nonZeroNumber,
  hard: z.boolean(),
})

const transactionSchema = logicalSchema

const portablePayloadSchema = z.object({
  version: z.literal(CURRENT_VERSION),
  exportedAt: z.number().finite(),
  games: z.array(gameSchema),
  transactions: z.array(transactionSchema),
})

function assertUniqueIds(values: string[], label: string): void {
  const seenIds = new Set<string>()

  for (const value of values) {
    if (seenIds.has(value)) {
      throw new Error(`Duplicate ${label} id: ${value}`)
    }

    seenIds.add(value)
  }
}

function assertPortableRelationships(payload: PortablePayload): void {
  assertUniqueIds(
    payload.games.map((game) => game.id),
    'game',
  )
  assertUniqueIds(
    payload.transactions.map((transaction) => transaction.id),
    'transaction',
  )

  const gameIds = new Set(payload.games.map((game) => game.id))

  for (const transaction of payload.transactions) {
    if (!gameIds.has(transaction.gameId)) {
      throw new Error(`Transaction ${transaction.id} references missing game ${transaction.gameId}`)
    }
  }
}

function suffixImportedName(name: string): string {
  return name.endsWith(' (imported)') ? name : `${name} (imported)`
}

function sanitizeFileName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'botc-colorer'
}

export function parsePortablePayload(raw: unknown): PortablePayload {
  const migrated = applyMigrations(raw)
  const payload = portablePayloadSchema.parse(migrated) as PortablePayload
  assertPortableRelationships(payload)
  return payload
}

export function createPortablePayload(
  games: Game[],
  transactions: Transaction[],
  exportedAt = Date.now(),
): PortablePayload {
  const normalizedGames = [...games].sort(
    (left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id),
  )
  const selectedGameIds = new Set(normalizedGames.map((game) => game.id))
  const normalizedTransactions = [...transactions]
    .filter((transaction) => selectedGameIds.has(transaction.gameId))
    .sort(
      (left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id),
    )

  return {
    version: CURRENT_VERSION,
    exportedAt,
    games: normalizedGames,
    transactions: normalizedTransactions,
  }
}

export async function buildPortablePayload(
  gameIds?: string[],
  exportedAt = Date.now(),
): Promise<PortablePayload> {
  const gameRows = gameIds === undefined
    ? await db.games.orderBy('createdAt').toArray()
    : await db.games.where('id').anyOf(gameIds).toArray()
  const games = gameRows
    .map(decodeGameRow)
    .sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id))
  const selectedGameIds = new Set(games.map((game) => game.id))
  const transactionRows =
    selectedGameIds.size === 0
      ? []
      : gameIds === undefined
        ? await db.transactions.orderBy('createdAt').toArray()
        : await db.transactions.where('gameId').anyOf([...selectedGameIds]).toArray()
  const transactions = transactionRows
    .map(decodeTransactionRow)
    .filter((transaction) => selectedGameIds.has(transaction.gameId))
    .sort(
      (left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id),
    )

  return createPortablePayload(games, transactions, exportedAt)
}

export async function importPortablePayload(raw: unknown): Promise<PortableImportResult> {
  const payload = parsePortablePayload(raw)
  const existingGameIds = new Set((await db.games.toCollection().primaryKeys()) as string[])
  const existingTransactionIds = new Set(
    (await db.transactions.toCollection().primaryKeys()) as string[],
  )
  const nextGames: Game[] = []
  const nextTransactions: Transaction[] = []

  for (const game of payload.games) {
    const gameTransactions = payload.transactions.filter(
      (transaction) => transaction.gameId === game.id,
    )
    const hadCollision =
      existingGameIds.has(game.id) ||
      gameTransactions.some((transaction) => existingTransactionIds.has(transaction.id))
    const nextGameId = existingGameIds.has(game.id) ? crypto.randomUUID() : game.id

    existingGameIds.add(nextGameId)

    const nextGame: Game = {
      ...game,
      id: nextGameId,
      name: hadCollision ? suffixImportedName(game.name) : game.name,
    }
    nextGames.push(nextGame)

    for (const transaction of gameTransactions) {
      const nextTransactionId = existingTransactionIds.has(transaction.id)
        ? crypto.randomUUID()
        : transaction.id

      existingTransactionIds.add(nextTransactionId)
      nextTransactions.push({
        ...transaction,
        id: nextTransactionId,
        gameId: nextGameId,
      })
    }
  }

  await db.transaction('rw', db.games, db.transactions, async () => {
    await db.games.bulkPut(nextGames.map(encodeGameRow))
    await db.transactions.bulkPut(nextTransactions.map(encodeTransactionRow))
  })

  return {
    games: nextGames,
    transactions: nextTransactions,
  }
}

export async function shareOrDownloadPortablePayload(
  payload: PortablePayload,
  name: string,
): Promise<void> {
  const json = JSON.stringify(payload, null, 2)
  const fileName = `${sanitizeFileName(name)}.json`
  const file = new File([json], fileName, {
    type: 'application/json',
  })
  const navigatorWithShare = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean
  }

  if (typeof navigatorWithShare.share === 'function') {
    const canShareFiles =
      typeof navigatorWithShare.canShare === 'function'
        ? navigatorWithShare.canShare({ files: [file] })
        : false

    if (canShareFiles) {
      try {
        await navigatorWithShare.share({
          title: name,
          files: [file],
        })
        return
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
      }
    }
  }

  const blob = new Blob([json], {
    type: 'application/json',
  })
  const downloadUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = downloadUrl
  link.download = fileName
  link.rel = 'noopener'
  link.style.display = 'none'
  document.body.append(link)
  link.click()
  window.setTimeout(() => {
    link.remove()
    URL.revokeObjectURL(downloadUrl)
  }, 1000)
}
