import type { Game, PlayerId, Transaction } from '../../solver/types'

export interface ConditionalRange {
  lo: number
  hi: number
}

export interface SymmetricPairWeight {
  i: number
  j: number
  dyadicWeight: number
  range: ConditionalRange
}

export interface StateMatrixData {
  directedWeights: number[][]
  conditionalRanges: Array<Array<ConditionalRange | null>>
  symmetricPairs: SymmetricPairWeight[]
  maxAbsDirected: number
}

function trimNumber(value: number): string {
  if (Number.isInteger(value)) {
    return String(value)
  }

  const normalized = value.toFixed(2).replace(/\.?0+$/, '')
  return normalized === '-0' ? '0' : normalized
}

function createPositions(game: Game): Map<PlayerId, number> {
  return new Map(game.players.map((player, index) => [player.id, index]))
}

function getPosition(positions: Map<PlayerId, number>, playerId: PlayerId): number {
  const position = positions.get(playerId)

  if (position === undefined) {
    throw new Error(`Unknown player id in matrix view: ${playerId}`)
  }

  return position
}

function createZeroMatrix(size: number): number[][] {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => 0))
}

function createConditionalRangeMatrix(size: number): Array<Array<ConditionalRange | null>> {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => null))
}

function makePairKey(i: number, j: number): string {
  return i < j ? `${i}:${j}` : `${j}:${i}`
}

export function hasConditionalRange(range: ConditionalRange | null): boolean {
  return range !== null && (range.lo !== 0 || range.hi !== 0)
}

export function formatMatrixCellValue(
  directedWeight: number,
  range: ConditionalRange | null,
): string {
  const baseValue = trimNumber(directedWeight)

  if (range === null || (range.lo === 0 && range.hi === 0)) {
    return baseValue
  }

  return `${baseValue} + [${trimNumber(range.lo)}, ${trimNumber(range.hi)}]`
}

export function buildStateMatrixData(game: Game, txs: Transaction[]): StateMatrixData {
  const size = game.players.length
  const positions = createPositions(game)
  const directedWeights = createZeroMatrix(size)
  const conditionalRanges = createConditionalRangeMatrix(size)
  const pairRanges = new Map<string, ConditionalRange>()
  let maxAbsDirected = 0

  for (const transaction of txs) {
    if (!transaction.enabled) {
      continue
    }

    if (transaction.kind === 'dyadic') {
      const active = getPosition(positions, transaction.active)
      const passive = getPosition(positions, transaction.passive)

      if (active === passive) {
        throw new Error('Dyadic transactions cannot target the same player twice')
      }

      directedWeights[active][passive] += transaction.weight
      maxAbsDirected = Math.max(maxAbsDirected, Math.abs(directedWeights[active][passive]))
      continue
    }

    if (transaction.kind === 'color') {
      continue
    }

    for (const equation of transaction.equations) {
      const i = getPosition(positions, equation.i)
      const j = getPosition(positions, equation.j)

      if (i === j) {
        throw new Error('Conditional equations cannot target the same player twice')
      }

      const key = makePairKey(i, j)
      const range = pairRanges.get(key) ?? { lo: 0, hi: 0 }
      range.lo += Math.min(0, equation.weight)
      range.hi += Math.max(0, equation.weight)
      pairRanges.set(key, range)
    }
  }

  const symmetricPairs: SymmetricPairWeight[] = []

  for (let i = 0; i < size; i += 1) {
    for (let j = i + 1; j < size; j += 1) {
      const range = pairRanges.get(makePairKey(i, j)) ?? { lo: 0, hi: 0 }
      const visibleRange = hasConditionalRange(range) ? range : null

      conditionalRanges[i][j] = visibleRange
      conditionalRanges[j][i] = visibleRange

      const dyadicWeight = directedWeights[i][j] + directedWeights[j][i]

      if (dyadicWeight !== 0 || visibleRange !== null) {
        symmetricPairs.push({
          i,
          j,
          dyadicWeight,
          range,
        })
      }
    }
  }

  symmetricPairs.sort((left, right) => {
    const magnitudeDelta = Math.abs(right.dyadicWeight) - Math.abs(left.dyadicWeight)

    if (magnitudeDelta !== 0) {
      return magnitudeDelta
    }

    if (left.i !== right.i) {
      return left.i - right.i
    }

    return left.j - right.j
  })

  return {
    directedWeights,
    conditionalRanges,
    symmetricPairs,
    maxAbsDirected,
  }
}
