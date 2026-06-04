import { compileAst, type CompiledFormula, resolveFormula } from './formula'
import type {
  Color,
  ColoringContribution,
  Game,
  PlayerId,
  SolverResult,
  Transaction,
} from './types'

interface PreparedTx {
  tx: Transaction
  evaluate: CompiledFormula
}

const EMPTY_RESULTS: SolverResult[] = []

function buildPositionMap(game: Game): Map<PlayerId, number> {
  return new Map(game.players.map((player, index) => [player.id, index]))
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

function prepareTx(tx: Transaction, game: Game): PreparedTx {
  const positions = buildPositionMap(game)
  const resolved = resolveFormula(tx.formula, game.players)

  function getPlayerIndex(varName: string): number {
    const player = resolved.playerMap.get(varName)
    if (player === undefined) {
      throw new Error(`Unresolved variable '${varName}' in formula '${tx.formula}'`)
    }
    const pos = positions.get(player.id)
    if (pos === undefined) {
      throw new Error(`Player '${player.name}' not found in game`)
    }
    return pos
  }

  const evaluate = compileAst(resolved.ast, getPlayerIndex)
  return { tx, evaluate }
}

export function solveGame(game: Game, txs: Transaction[]): SolverResult[] {
  const playerCount = game.players.length

  if (playerCount === 0) {
    return EMPTY_RESULTS
  }

  if (playerCount > 16) {
    throw new Error('The solver supports at most 16 players')
  }

  const enabledTxs = txs.filter((tx) => tx.enabled)
  const prepared = enabledTxs.map((tx) => prepareTx(tx, game))
  const hardTxs = prepared.filter((p) => p.tx.hard)
  const softTxs = prepared.filter((p) => !p.tx.hard)

  const results: SolverResult[] = []
  const upperBound = 1 << playerCount

  for (let coloring = 0; coloring < upperBound; coloring += 1) {
    const blueCount = countBits(coloring)

    if (blueCount < game.blueCountMin || blueCount > game.blueCountMax) {
      continue
    }

    let pruned = false
    for (const { evaluate } of hardTxs) {
      if (!evaluate(coloring)) {
        pruned = true
        break
      }
    }
    if (pruned) continue

    let fitness = 0
    for (const { tx, evaluate } of softTxs) {
      const satisfied = evaluate(coloring)
      fitness += satisfied ? Math.abs(tx.weight) : -Math.abs(tx.weight)
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
  const contributions: ColoringContribution[] = []

  for (const tx of txs) {
    if (!tx.enabled) continue

    const { evaluate } = prepareTx(tx, game)
    const satisfied = evaluate(coloring)

    contributions.push({
      sourceTxId: tx.id,
      formula: tx.formula,
      weight: tx.weight,
      hard: tx.hard,
      satisfied,
      contribution: tx.hard ? 0 : (satisfied ? Math.abs(tx.weight) : -Math.abs(tx.weight)),
    })
  }

  return contributions
}

export function formatColoringBits(coloring: number, playerCount: number): Color[] {
  return Array.from({ length: playerCount }, (_, position) => getColorAt(coloring, position))
}
