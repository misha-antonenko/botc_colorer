import type { ColorTx, ConditionalTx, DyadicTx, Game, Player, Transaction } from '../solver/types'

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

export function createDyadicTxFixture(
  overrides: Partial<DyadicTx> & Pick<DyadicTx, 'active' | 'passive' | 'weight'>,
): DyadicTx {
  return {
    id: `tx-${Math.random().toString(36).slice(2)}`,
    kind: 'dyadic',
    gameId: 'game-1',
    createdAt: 200,
    enabled: true,
    ...overrides,
  }
}

export function createColorTxFixture(
  overrides: Partial<ColorTx> & Pick<ColorTx, 'playerId' | 'color'>,
): ColorTx {
  return {
    id: `tx-${Math.random().toString(36).slice(2)}`,
    kind: 'color',
    gameId: 'game-1',
    createdAt: 250,
    enabled: true,
    ...overrides,
  }
}

export function createConditionalTxFixture(
  overrides: Partial<ConditionalTx> &
    Pick<ConditionalTx, 'condition' | 'equations'>,
): ConditionalTx {
  return {
    id: `tx-${Math.random().toString(36).slice(2)}`,
    kind: 'conditional',
    gameId: 'game-1',
    createdAt: 300,
    enabled: true,
    ...overrides,
  }
}

export function sortTransactionsById(transactions: Transaction[]): Transaction[] {
  return [...transactions].sort((left, right) => left.id.localeCompare(right.id))
}
