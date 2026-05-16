import { z } from 'zod'
import type { Game, PortableImportResult, PortablePayload, Transaction } from '../solver/types'
import { snapshotGameState } from './backup'
import { db, decodeGameRow, decodeTransactionRow, encodeGameRow, encodeTransactionRow } from './schema'

const colorSchema = z.enum(['blue', 'red'])
const nonZeroNumber = z.number().finite().refine((value) => value !== 0, {
  message: 'Expected a nonzero number',
})

const playerSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  fixedColor: colorSchema.nullable(),
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

const equationSchema = z.object({
  i: z.string().min(1),
  j: z.string().min(1),
  weight: nonZeroNumber,
})

const baseTxSchema = z.object({
  id: z.string().min(1),
  gameId: z.string().min(1),
  createdAt: z.number().finite(),
  enabled: z.boolean(),
  note: z.string().optional(),
})

const dyadicSchema = baseTxSchema.extend({
  kind: z.literal('dyadic'),
  active: z.string().min(1),
  passive: z.string().min(1),
  weight: nonZeroNumber,
})

const conditionalSchema = baseTxSchema.extend({
  kind: z.literal('conditional'),
  condition: z.object({
    playerId: z.string().min(1),
    color: colorSchema,
  }),
  equations: z.array(equationSchema).min(1),
})

const transactionSchema = z.discriminatedUnion('kind', [dyadicSchema, conditionalSchema])

const portablePayloadSchema = z.object({
  version: z.literal(1),
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

  const playerIdsByGameId = new Map<string, Set<string>>()

  for (const game of payload.games) {
    playerIdsByGameId.set(
      game.id,
      new Set(game.players.map((player) => player.id)),
    )
  }

  for (const transaction of payload.transactions) {
    const playerIds = playerIdsByGameId.get(transaction.gameId)

    if (playerIds === undefined) {
      throw new Error(`Transaction ${transaction.id} references missing game ${transaction.gameId}`)
    }

    if (transaction.kind === 'dyadic') {
      if (!playerIds.has(transaction.active) || !playerIds.has(transaction.passive)) {
        throw new Error(`Transaction ${transaction.id} references missing players`)
      }
      continue
    }

    if (!playerIds.has(transaction.condition.playerId)) {
      throw new Error(`Transaction ${transaction.id} references missing condition player`)
    }

    for (const equation of transaction.equations) {
      if (!playerIds.has(equation.i) || !playerIds.has(equation.j)) {
        throw new Error(`Transaction ${transaction.id} references missing equation players`)
      }
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
  const payload = portablePayloadSchema.parse(raw) as PortablePayload
  assertPortableRelationships(payload)
  return payload
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

  return {
    version: 1,
    exportedAt,
    games,
    transactions,
  }
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

  await Promise.all(nextGames.map((game) => snapshotGameState(game.id)))

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

  if (
    typeof navigatorWithShare.share === 'function' &&
    navigatorWithShare.canShare?.({ files: [file] })
  ) {
    await navigatorWithShare.share({
      title: name,
      files: [file],
    })
    return
  }

  const blob = new Blob([json], {
    type: 'application/json',
  })
  const downloadUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = downloadUrl
  link.download = fileName
  link.click()
  URL.revokeObjectURL(downloadUrl)
}
