/**
 * Migration system for both the portable payload format and the IndexedDB
 * schema. All migration logic lives here so each version transition has a
 * single implementation.
 *
 * To add a future migration (N -> M):
 *   1. Bump CURRENT_VERSION to M.
 *   2. Update PortablePayload.version in types.ts to match.
 *   3. Add typed raw shapes for the v-N data (only fields the migration reads).
 *   4. Extract any non-trivial conversion into a named, exported helper so the
 *      Dexie upgrade can call the same function (no logic duplication).
 *   5. Write migrateVNtoVM() and append { from: N, apply: migrateVNtoVM }
 *      to MIGRATIONS.
 *   6. Add this.version(M).upgrade(...) in schema.ts calling the shared helper.
 *   7. Add tests.
 */

import type { LogicalTx } from '../solver/types'

export const CURRENT_VERSION = 3

interface MigrationStep {
  from: number
  apply: (raw: Record<string, unknown>) => Record<string, unknown>
}

// -- v1 raw shapes ------------------------------------------------------------

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

// -- v2 raw shapes ------------------------------------------------------------

interface V2Equation {
  i: string
  j: string
  weight: number
}

interface V2DyadicTx {
  kind: 'dyadic'
  id: string
  gameId: string
  createdAt: number
  enabled: boolean
  note?: string
  active: string
  passive: string
  weight: number
}

interface V2ColorTx {
  kind: 'color'
  id: string
  gameId: string
  createdAt: number
  enabled: boolean
  note?: string
  playerId: string
  color: 'blue' | 'red'
}

interface V2ConditionalTx {
  kind: 'conditional'
  id: string
  gameId: string
  createdAt: number
  enabled: boolean
  note?: string
  condition: { playerId: string; color: 'blue' | 'red' }
  equations: V2Equation[]
}

type V2Transaction = V2DyadicTx | V2ColorTx | V2ConditionalTx

interface V2Player {
  id: string
  name: string
}

interface V2Game {
  id: string
  players: V2Player[]
}

interface V2Payload {
  version: 2
  exportedAt: number
  games: V2Game[]
  transactions: V2Transaction[]
}

// -- Shared migration helpers -------------------------------------------------

export function buildColorTxesFromPlayers(
  gameId: string,
  updatedAt: number,
  players: ReadonlyArray<V1Player>,
): V2ColorTx[] {
  return players
    .filter(
      (player): player is V1Player & { fixedColor: 'blue' | 'red' } =>
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

function getPlayerNameById(games: V2Game[], gameId: string, playerId: string): string {
  const game = games.find((g) => g.id === gameId)
  if (game === undefined) return playerId
  const player = game.players.find((p) => p.id === playerId)
  return player?.name ?? playerId
}

export function convertV2TxToLogical(
  tx: V2Transaction,
  games: V2Game[],
): LogicalTx[] {
  const base = {
    gameId: tx.gameId,
    createdAt: tx.createdAt,
    enabled: tx.enabled,
    note: tx.note,
  }

  if (tx.kind === 'dyadic') {
    const activeName = getPlayerNameById(games, tx.gameId, tx.active)
    const passiveName = getPlayerNameById(games, tx.gameId, tx.passive)
    const operator = tx.weight > 0 ? '=' : '^'
    return [
      {
        ...base,
        id: tx.id,
        kind: 'logical',
        formula: `${activeName} ${operator} ${passiveName}`,
        weight: Math.abs(tx.weight),
        hard: false,
      },
    ]
  }

  if (tx.kind === 'color') {
    const playerName = getPlayerNameById(games, tx.gameId, tx.playerId)
    const formula = tx.color === 'blue' ? `~${playerName}` : playerName
    return [
      {
        ...base,
        id: tx.id,
        kind: 'logical',
        formula,
        weight: 1,
        hard: true,
      },
    ]
  }

  // Conditional: one logical tx per equation
  const condPlayerName = getPlayerNameById(games, tx.gameId, tx.condition.playerId)
  const condFormula = tx.condition.color === 'blue' ? `~${condPlayerName}` : condPlayerName

  return tx.equations.map((eq, index) => {
    const iName = getPlayerNameById(games, tx.gameId, eq.i)
    const jName = getPlayerNameById(games, tx.gameId, eq.j)
    const eqOperator = eq.weight > 0 ? '=' : '^'
    const eqFormula = `${iName} ${eqOperator} ${jName}`
    return {
      ...base,
      id: index === 0 ? tx.id : crypto.randomUUID(),
      kind: 'logical' as const,
      formula: `${condFormula} => (${eqFormula})`,
      weight: Math.abs(eq.weight),
      hard: false,
    }
  })
}

// -- Migrations ---------------------------------------------------------------

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

function migrateV2ToV3(raw: Record<string, unknown>): Record<string, unknown> {
  const payload = raw as unknown as V2Payload
  const logicalTxs: Record<string, unknown>[] = []

  for (const tx of payload.transactions) {
    const converted = convertV2TxToLogical(tx, payload.games)
    logicalTxs.push(...(converted as unknown as Record<string, unknown>[]))
  }

  return {
    ...payload,
    version: 3,
    transactions: logicalTxs,
  }
}

const MIGRATIONS: MigrationStep[] = [
  { from: 1, apply: migrateV1ToV2 },
  { from: 2, apply: migrateV2ToV3 },
]

// -- Public API ---------------------------------------------------------------

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
