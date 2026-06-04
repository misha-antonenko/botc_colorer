export type PlayerId = string
export type GameId = string
export type TxId = string
export type Color = 'blue' | 'red'
export type SolutionsCap = 10 | 50 | 100
export type WorkspaceTab = 'setup' | 'state' | 'transactions' | 'solutions'

export interface Player {
  id: PlayerId
  name: string
}

export interface Game {
  id: GameId
  name: string
  createdAt: number
  updatedAt: number
  blueCountMin: number
  blueCountMax: number
  players: Player[]
}

export interface BaseTx {
  id: TxId
  gameId: GameId
  createdAt: number
  enabled: boolean
  note?: string
}

export interface LogicalTx extends BaseTx {
  kind: 'logical'
  formula: string
  weight: number
  hard: boolean
}

export type Transaction = LogicalTx

export interface SolverResult {
  c: number
  fitness: number
}

export interface SolveRequest {
  kind: 'solve'
  game: Game
  txs: Transaction[]
}

export interface SolveResponse {
  kind: 'solved'
  results: SolverResult[]
  elapsedMs: number
}

export interface ColoringContribution {
  sourceTxId: TxId
  formula: string
  weight: number
  hard: boolean
  satisfied: boolean
  contribution: number
}

/** Must match CURRENT_VERSION in src/db/migrations.ts. */
export interface PortablePayload {
  version: 3
  exportedAt: number
  games: Game[]
  transactions: Transaction[]
}

export interface PortableImportResult {
  games: Game[]
  transactions: Transaction[]
}
