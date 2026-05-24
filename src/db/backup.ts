import type { Game, GameId, PortablePayload, Transaction } from '../solver/types'
import { applyMigrations } from './migrations'
import { db, decodeGameRow, decodeTransactionRow } from './schema'

const BACKUP_SLOT_COUNT = 3
const BACKUP_PREFIX = 'botc:backup'
const SNAPSHOT_VERSION = 1

export interface GameSnapshot {
  version: typeof SNAPSHOT_VERSION
  savedAt: number
  game: Game
  transactions: Transaction[]
}

function getBackupIndexKey(gameId: GameId): string {
  return `${BACKUP_PREFIX}:${gameId}:index`
}

function getBackupSlotKey(gameId: GameId, slot: number): string {
  return `${BACKUP_PREFIX}:${gameId}:${slot}`
}

export async function snapshotGameState(gameId: GameId): Promise<void> {
  const gameRow = await db.games.get(gameId)

  if (gameRow === undefined) {
    return
  }

  const transactionRows = await db.transactions.where('gameId').equals(gameId).sortBy('createdAt')
  const snapshot: GameSnapshot = {
    version: SNAPSHOT_VERSION,
    savedAt: Date.now(),
    game: decodeGameRow(gameRow),
    transactions: transactionRows.map(decodeTransactionRow),
  }
  const previousIndex = Number(localStorage.getItem(getBackupIndexKey(gameId)) ?? '-1')
  const nextIndex = (previousIndex + 1 + BACKUP_SLOT_COUNT) % BACKUP_SLOT_COUNT

  localStorage.setItem(getBackupSlotKey(gameId, nextIndex), JSON.stringify(snapshot))
  localStorage.setItem(getBackupIndexKey(gameId), String(nextIndex))
}

export function listGameSnapshots(gameId: GameId): GameSnapshot[] {
  const snapshots: GameSnapshot[] = []

  for (let slot = 0; slot < BACKUP_SLOT_COUNT; slot += 1) {
    const rawSnapshot = localStorage.getItem(getBackupSlotKey(gameId, slot))

    if (rawSnapshot === null) {
      continue
    }

    try {
      const parsedSnapshot = JSON.parse(rawSnapshot) as GameSnapshot

      if (parsedSnapshot.version === SNAPSHOT_VERSION && parsedSnapshot.game.id === gameId) {
        snapshots.push(parsedSnapshot)
      }
    } catch {
      continue
    }
  }

  return snapshots.sort((left, right) => right.savedAt - left.savedAt)
}

export function getLatestGameSnapshot(gameId: GameId): GameSnapshot | null {
  return listGameSnapshots(gameId)[0] ?? null
}

export function snapshotToPortablePayload(snapshot: GameSnapshot): PortablePayload {
  // Snapshot data is v1-shaped (players may carry fixedColor). Apply migrations
  // so the returned payload is always at the current portable version.
  const raw = {
    version: SNAPSHOT_VERSION,
    exportedAt: snapshot.savedAt,
    games: [snapshot.game],
    transactions: snapshot.transactions,
  }
  return applyMigrations(raw) as PortablePayload
}
