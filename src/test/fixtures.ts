import type { Game, LogicalTx, Player, Transaction } from '../solver/types'

export function createPlayers(names: string[]): Player[] {
  return names.map((name, index) => ({
    id: `p${index + 1}`,
    name,
  }))
}

export function createGameFixture(overrides: Partial<Game> = {}): Game {
  const players = overrides.players ?? createPlayers(['Alice', 'Bob', 'Carol'])

  return {
    id: 'game-1',
    name: 'Fixture game',
    createdAt: 100,
    updatedAt: 100,
    blueCountMin: 0,
    blueCountMax: players.length,
    players,
    ...overrides,
  }
}

export function createLogicalTxFixture(
  overrides: Partial<LogicalTx> & Pick<LogicalTx, 'formula'>,
): LogicalTx {
  return {
    id: `tx-${Math.random().toString(36).slice(2)}`,
    kind: 'logical',
    gameId: 'game-1',
    createdAt: 200,
    enabled: true,
    weight: 1,
    hard: false,
    ...overrides,
  }
}

export function sortTransactionsById(transactions: Transaction[]): Transaction[] {
  return [...transactions].sort((left, right) => left.id.localeCompare(right.id))
}
