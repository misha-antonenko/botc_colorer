/**
 * Portable payload migration system.
 *
 * Each entry in MIGRATIONS transforms a raw payload from one version to the
 * next. applyMigrations walks the chain from the detected version to
 * CURRENT_VERSION. To add a future migration, append a new entry.
 */

export const CURRENT_VERSION = 2

interface MigrationStep {
  from: number
  apply: (raw: Record<string, unknown>) => Record<string, unknown>
}

// ── v1 raw shapes (only the fields the migration needs) ───────────────────────

interface V1Player {
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

// ── Migrations ────────────────────────────────────────────────────────────────

function migrateV1ToV2(raw: Record<string, unknown>): Record<string, unknown> {
  const payload = raw as unknown as V1Payload
  const addedTransactions: Record<string, unknown>[] = []

  const migratedGames = payload.games.map((game) => {
    const migratedPlayers = game.players.map((player) => {
      if (player.fixedColor !== null) {
        addedTransactions.push({
          id: crypto.randomUUID(),
          kind: 'color',
          gameId: game.id,
          createdAt: game.updatedAt,
          enabled: true,
          playerId: player.id,
          color: player.fixedColor,
        })
      }

      return { ...player, fixedColor: null }
    })

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
