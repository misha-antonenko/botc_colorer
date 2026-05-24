export type PlayerId = string
export type GameId = string
export type TxId = string
export type Color = 'blue' | 'red'
export type SolutionsCap = 10 | 50 | 100
export type WorkspaceTab = 'setup' | 'state' | 'transactions' | 'solutions'

export interface Player {
  id: PlayerId
  name: string
  fixedColor: Color | null
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

export interface Equation {
  i: PlayerId
  j: PlayerId
  weight: number
}

export interface BaseTx {
  id: TxId
  gameId: GameId
  createdAt: number
  enabled: boolean
  note?: string
}

export interface DyadicTx extends BaseTx {
  kind: 'dyadic'
  active: PlayerId
  passive: PlayerId
  weight: number
}

export interface ColorTx extends BaseTx {
  kind: 'color'
  playerId: PlayerId
  color: Color
}

export interface ConditionalTx extends BaseTx {
  kind: 'conditional'
  condition: {
    playerId: PlayerId
    color: Color
  }
  equations: Equation[]
}

export type Transaction = DyadicTx | ColorTx | ConditionalTx

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
  id: string
  sourceTxId: TxId
  sourceKind: Transaction['kind']
  i: PlayerId
  j: PlayerId
  condition?: {
    playerId: PlayerId
    color: Color
  }
  /** Set for color-constraint contributions; absent for equation contributions. */
  fixedColor?: Color
  weight: number
  satisfied: boolean
  contribution: number
  active: boolean
}

export interface PortablePayload {
  version: 1
  exportedAt: number
  games: Game[]
  transactions: Transaction[]
}

export interface PortableImportResult {
  games: Game[]
  transactions: Transaction[]
}
