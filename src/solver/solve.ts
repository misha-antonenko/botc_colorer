import type {
  ColoringContribution,
  Color,
  ConditionalTx,
  Game,
  PlayerId,
  SolverResult,
  Transaction,
} from './types'

interface PreparedDyadicPair {
  i: number
  j: number
  weight: number
}

interface PreparedConditional {
  tx: ConditionalTx
  conditionIndex: number
  want: 0 | 1
  equations: Array<{
    i: number
    j: number
    weight: number
  }>
}

const EMPTY_RESULTS: SolverResult[] = []

function buildPositionMap(game: Game): Map<PlayerId, number> {
  return new Map(game.players.map((player, index) => [player.id, index]))
}

function getPlayerIndex(positions: Map<PlayerId, number>, playerId: PlayerId): number {
  const position = positions.get(playerId)

  if (position === undefined) {
    throw new Error(`Unknown player id: ${playerId}`)
  }

  return position
}

function countBits(value: number): number {
  let remaining = value
  let count = 0

  while (remaining !== 0) {
    remaining &= remaining - 1
    count += 1
  }

  return count
}

function isBlueAt(coloring: number, position: number): boolean {
  return ((coloring >> position) & 1) === 1
}

function getLexKey(coloring: number, playerCount: number): number {
  let key = 0

  for (let position = 0; position < playerCount; position += 1) {
    const digit = isBlueAt(coloring, position) ? 0 : 1
    key = (key << 1) | digit
  }

  return key
}

function sameColor(coloring: number, i: number, j: number): boolean {
  return isBlueAt(coloring, i) === isBlueAt(coloring, j)
}

function normalizeEquationWeight(weight: number): number {
  if (!Number.isFinite(weight) || weight === 0) {
    throw new Error('Equation weights must be finite and nonzero')
  }

  return weight
}

function buildPreparedDyadicPairs(game: Game, txs: Transaction[]): PreparedDyadicPair[] {
  const positions = buildPositionMap(game)
  const pairWeights = new Map<string, number>()

  for (const tx of txs) {
    if (!tx.enabled || tx.kind !== 'dyadic') {
      continue
    }

    const activeIndex = getPlayerIndex(positions, tx.active)
    const passiveIndex = getPlayerIndex(positions, tx.passive)

    if (activeIndex === passiveIndex) {
      throw new Error('Dyadic transactions cannot be self-referential')
    }

    const lo = Math.min(activeIndex, passiveIndex)
    const hi = Math.max(activeIndex, passiveIndex)
    const key = `${lo}:${hi}`
    const nextWeight = (pairWeights.get(key) ?? 0) + normalizeEquationWeight(tx.weight)
    pairWeights.set(key, nextWeight)
  }

  return [...pairWeights.entries()]
    .filter(([, weight]) => weight !== 0)
    .map(([key, weight]) => {
      const [i, j] = key.split(':').map(Number)
      return { i, j, weight }
    })
}

function buildPreparedConditionals(game: Game, txs: Transaction[]): PreparedConditional[] {
  const positions = buildPositionMap(game)

  return txs
    .filter((tx): tx is ConditionalTx => tx.enabled && tx.kind === 'conditional')
    .map((tx) => ({
      tx,
      conditionIndex: getPlayerIndex(positions, tx.condition.playerId),
      want: tx.condition.color === 'blue' ? 1 : 0,
      equations: tx.equations.map((equation) => {
        const i = getPlayerIndex(positions, equation.i)
        const j = getPlayerIndex(positions, equation.j)

        if (i === j) {
          throw new Error('Conditional equations cannot be self-referential')
        }

        return {
          i,
          j,
          weight: normalizeEquationWeight(equation.weight),
        }
      }),
    }))
}

function buildFixedColorMasks(game: Game): { mustBeBlue: number; mustBeRed: number } {
  let mustBeBlue = 0
  let mustBeRed = 0

  for (const [index, player] of game.players.entries()) {
    if (player.fixedColor === 'blue') {
      mustBeBlue |= 1 << index
    } else if (player.fixedColor === 'red') {
      mustBeRed |= 1 << index
    }
  }

  return { mustBeBlue, mustBeRed }
}

export function solveGame(game: Game, txs: Transaction[]): SolverResult[] {
  const playerCount = game.players.length

  if (playerCount === 0) {
    return EMPTY_RESULTS
  }

  if (playerCount > 16) {
    throw new Error('The solver supports at most 16 players')
  }

  const dyadicPairs = buildPreparedDyadicPairs(game, txs)
  const conditionals = buildPreparedConditionals(game, txs)
  const { mustBeBlue, mustBeRed } = buildFixedColorMasks(game)
  const results: SolverResult[] = []
  const upperBound = 1 << playerCount

  for (let coloring = 0; coloring < upperBound; coloring += 1) {
    const blueCount = countBits(coloring)

    if (blueCount < game.blueCountMin || blueCount > game.blueCountMax) {
      continue
    }

    if ((coloring & mustBeBlue) !== mustBeBlue) {
      continue
    }

    if ((coloring & mustBeRed) !== 0) {
      continue
    }

    let fitness = 0

    for (const pair of dyadicPairs) {
      fitness += sameColor(coloring, pair.i, pair.j) ? pair.weight : -pair.weight
    }

    for (const conditional of conditionals) {
      if (((coloring >> conditional.conditionIndex) & 1) !== conditional.want) {
        continue
      }

      for (const equation of conditional.equations) {
        fitness += sameColor(coloring, equation.i, equation.j)
          ? equation.weight
          : -equation.weight
      }
    }

    results.push({ c: coloring, fitness })
  }

  results.sort((left, right) => {
    if (left.fitness !== right.fitness) {
      return right.fitness - left.fitness
    }

    return getLexKey(left.c, playerCount) - getLexKey(right.c, playerCount)
  })

  return results
}

export function getColorAt(coloring: number, position: number): Color {
  return isBlueAt(coloring, position) ? 'blue' : 'red'
}

export function buildColoringContributionBreakdown(
  game: Game,
  txs: Transaction[],
  coloring: number,
): ColoringContribution[] {
  const positions = buildPositionMap(game)
  const contributions: ColoringContribution[] = []

  for (const tx of txs) {
    if (!tx.enabled) {
      continue
    }

    if (tx.kind === 'dyadic') {
      const i = getPlayerIndex(positions, tx.active)
      const j = getPlayerIndex(positions, tx.passive)
      const weight = normalizeEquationWeight(tx.weight)
      const satisfied = sameColor(coloring, i, j)

      contributions.push({
        id: `${tx.id}:dyadic`,
        sourceTxId: tx.id,
        sourceKind: tx.kind,
        i: tx.active,
        j: tx.passive,
        weight,
        satisfied,
        contribution: satisfied ? weight : -weight,
        active: true,
      })

      continue
    }

    const conditionIndex = getPlayerIndex(positions, tx.condition.playerId)
    const want = tx.condition.color === 'blue' ? 1 : 0

    if (((coloring >> conditionIndex) & 1) !== want) {
      continue
    }

    tx.equations.forEach((equation, equationIndex) => {
      const i = getPlayerIndex(positions, equation.i)
      const j = getPlayerIndex(positions, equation.j)
      const weight = normalizeEquationWeight(equation.weight)
      const satisfied = sameColor(coloring, i, j)

      contributions.push({
        id: `${tx.id}:conditional:${equationIndex}`,
        sourceTxId: tx.id,
        sourceKind: tx.kind,
        i: equation.i,
        j: equation.j,
        weight,
        satisfied,
        contribution: satisfied ? weight : -weight,
        active: true,
      })
    })
  }

  return contributions
}

export function formatColoringBits(coloring: number, playerCount: number): Color[] {
  return Array.from({ length: playerCount }, (_, position) => getColorAt(coloring, position))
}
