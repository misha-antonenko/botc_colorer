import { useMemo } from 'react'
import {
  buildColoringContributionBreakdown,
  formatColoringBits,
} from '../../solver/solve'
import type { Game, SolverResult, Transaction } from '../../solver/types'
import {
  formatConditionSummary,
  formatEquationSummary,
  formatSignedNumber,
  getPlayerCellLabel,
} from '../formatters'

interface ColoringRowProps {
  game: Game
  txs: Transaction[]
  result: SolverResult
  isTiedWithPrevious: boolean
  expanded: boolean
  onToggle: () => void
}

export function ColoringRow({
  game,
  txs,
  result,
  isTiedWithPrevious,
  expanded,
  onToggle,
}: ColoringRowProps) {
  const colors = useMemo(
    () => formatColoringBits(result.c, game.players.length),
    [game.players.length, result.c],
  )
  const contributions = useMemo(
    () => (expanded ? buildColoringContributionBreakdown(game, txs, result.c) : []),
    [expanded, game, result.c, txs],
  )

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 shadow-lg shadow-slate-950/30">
      <button
        type="button"
        className="flex w-full flex-col gap-3 px-4 py-4 text-left"
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {colors.map((color, index) => (
              <span
                key={index}
                className={`flex h-11 w-11 flex-col items-center justify-center rounded-lg border ${
                  color === 'blue'
                    ? 'border-blue-300/40 bg-blue-500/80 text-white'
                    : 'border-red-300/40 bg-red-500/80 text-white'
                }`}
              >
                <span className="text-xs font-bold">{index + 1}</span>
                <span className="text-[8px] leading-none opacity-90">
                  {getPlayerCellLabel(game.players[index]?.name ?? '')}
                </span>
              </span>
            ))}
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold text-slate-100">
              {`Fitness = ${formatSignedNumber(result.fitness)}`}
            </div>
            {isTiedWithPrevious ? (
              <div className="text-xs text-slate-400">Tied with the previous one.</div>
            ) : null}
          </div>
        </div>
      </button>

      {expanded ? (
        <div className="border-t border-slate-800 px-4 py-4">
          <div className="mb-3 text-sm font-semibold text-slate-100">Equation breakdown</div>
          <div className="space-y-2">
            {contributions.map((contribution) => (
              <div
                key={contribution.id}
                className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-200"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {formatEquationSummary(game, contribution.i, contribution.j, contribution.weight)}
                  </span>
                  <span className="font-mono text-slate-300">
                    {formatSignedNumber(contribution.contribution)}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  {contribution.satisfied ? 'satisfied' : 'unsatisfied'}
                  {contribution.condition === undefined ? null : ' · ' + formatConditionSummary(
                    game,
                    contribution.condition.playerId,
                    contribution.condition.color,
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
