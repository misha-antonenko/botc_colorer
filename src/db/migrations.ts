/**
 * Migration system for both the portable payload format and the IndexedDB
 * schema. All migration logic lives here so each version transition has a
 * single implementation.
 *
 * Portable payload: applyMigrations() walks the chain from the detected
 * version to CURRENT_VERSION before Zod parsing.
 *
 * IndexedDB: the Dexie schema upgrade in schema.ts calls
 * buildColorTxesFromPlayers() directly, sharing the same core logic.
 *
 * To add a future migration:
 *   1. Bump CURRENT_VERSION.
 *   2. Add the typed raw shapes for the old version.
 *   3. Write a migrateVNtoVM() function using any shared helpers needed.
 *   4. Append { from: N, apply: migrateVNtoVM } to MIGRATIONS.
 *   5. Add the corresponding Dexie version(M).upgrade() call in schema.ts.
 */

import type { ColorTx } from '../solver/types'

export const CURRENT_VERSION = 2

interface MigrationStep {
  from: number
  apply: (raw: Record<string, unknown>) => Record<string, unknown>
}

// ── v1 raw shapes (only the fields each migration needs) ──────────────────────

export interface V1Player {
  id: string
  fixedColor: 'blue' | 'red' | null
}

interface V1Game {
  id: string
  updatedAt: number
  players: V1Player[]
}

interface V1Payload {
  version: 1
  exportedAt: number
  games: V1Game[]
  transactions: Record<string, unknown>[]
}

// ── Shared migration helpers ──────────────────────────────────────────────────

/**
 * Converts each player with a non-null fixedColor into a ColorTx. Used by
 * both the portable-payload migration and the IndexedDB schema upgrade so the
 * logic is defined exactly once.
 */
export function buildColorTxesFromPlayers(
  gameId: string,
  updatedAt: number,
  players: ReadonlyArray<V1Player>,
): ColorTx[] {
  return players
    .filter((player): player is V1Player & { fixedColor: 'blue' | 'red' } =>
      player.fixedColor !== null,
    )
    .map((player) => ({
      id: crypto.randomUUID(),
      kind: 'color' as const,
      gameId,
      createdAt: updatedAt,
      enabled: true,
      playerId: player.id,
      color: player.fixedColor,
    }))
}

// ── Migrations ────────────────────────────────────────────────────────────────

function migrateV1ToV2(raw: Record<string, unknown>): Record<string, unknown> {
  const payload = raw as unknown as V1Payload
  const addedTransactions: Record<string, unknown>[] = []

  const migratedGames = payload.games.map((game) => {
    const colorTxes = buildColorTxesFromPlayers(game.id, game.updatedAt, game.players)
    addedTransactions.push(...(colorTxes as unknown as Record<string, unknown>[]))

    const migratedPlayers = game.players.map((player) => ({ ...player, fixedColor: null }))
    return { ...game, players: migratedPlayers }
  })

  return {
    ...payload,
    version: 2,
    games: migratedGames,
    transactions: [...payload.transactions, ...addedTransactions],
  }
}

const MIGRATIONS: MigrationStep[] = [
  { from: 1, apply: migrateV1ToV2 },
]

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Applies all pending migrations to a raw portable payload object, bringing it
 * up to CURRENT_VERSION. Throws if no migration exists for the detected version.
 */
export function applyMigrations(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) {
    return raw
  }

  let current = raw as Record<string, unknown>

  while (true) {
    const version = typeof current.version === 'number' ? current.version : 1

    if (version >= CURRENT_VERSION) {
      break
    }

    const migration = MIGRATIONS.find((m) => m.from === version)

    if (migration === undefined) {
      throw new Error(`No migration found from payload version ${version}`)
    }

    current = migration.apply(current)
  }

  return current
}
