import type { Color, Game, PlayerId, Transaction } from '../solver/types'

function trimTrailingZeros(value: number): string {
  if (Number.isInteger(value)) {
    return String(value)
  }

  const normalized = value.toFixed(2).replace(/\.?0+$/, '')
  return normalized === '-0' ? '0' : normalized
}

function getPlayerRecord(game: Game, playerId: PlayerId) {
  const index = game.players.findIndex((player) => player.id === playerId)

  if (index === -1) {
    return null
  }

  return {
    player: game.players[index],
    index,
  }
}

export function formatSignedNumber(value: number): string {
  const normalized = trimTrailingZeros(value)
  return value > 0 ? `+${normalized}` : normalized
}

export function formatMagnitude(value: number): string {
  return trimTrailingZeros(Math.abs(value))
}

export function getPlayerName(game: Game, playerId: PlayerId): string {
  const playerRecord = getPlayerRecord(game, playerId)

  if (playerRecord === null) {
    return playerId
  }

  const trimmedName = playerRecord.player.name.trim()
  return trimmedName === '' ? `Seat ${playerRecord.index + 1}` : trimmedName
}

export function getPlayerSeatLabel(game: Game, playerId: PlayerId): string {
  const playerRecord = getPlayerRecord(game, playerId)

  if (playerRecord === null) {
    return playerId
  }

  return `${getPlayerName(game, playerId)} (#${playerRecord.index + 1})`
}

export function getPlayerCellLabel(name: string): string {
  const trimmedName = name.trim()

  if (trimmedName === '') {
    return '?'
  }

  return trimmedName.slice(0, 3)
}

export function formatEquationSummary(
  game: Game,
  i: PlayerId,
  j: PlayerId,
  weight: number,
): string {
  const relation = weight > 0 ? '=' : '≠'
  return `${getPlayerName(game, i)} ${relation} ${getPlayerName(game, j)}, w = ${formatMagnitude(weight)}`
}

export function formatConditionSummary(game: Game, playerId: PlayerId, color: Color): string {
  return `if ${getPlayerName(game, playerId)} is ${color}`
}

export function summarizeTransaction(game: Game, transaction: Transaction): string {
  if (transaction.kind === 'dyadic') {
    return `${getPlayerName(game, transaction.active)} → ${getPlayerName(
      game,
      transaction.passive,
    )}, w = ${formatSignedNumber(transaction.weight)}`
  }

  const equationSummary = transaction.equations
    .map((equation) => formatEquationSummary(game, equation.i, equation.j, equation.weight))
    .join('; ')

  return `${formatConditionSummary(game, transaction.condition.playerId, transaction.condition.color)}: ${equationSummary}`
}

export function formatTimestamp(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(timestamp)
}
