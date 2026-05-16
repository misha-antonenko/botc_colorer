import { useState } from 'react'
import type { Game, SolverResult, Transaction } from '../../../solver/types'
import { DEFAULT_SOLUTION_CAP, useUiStore } from '../../../state/store'
import { ColoringRow } from '../../components/ColoringRow'

interface SolutionsTabProps {
  game: Game
  txs: Transaction[]
  results: SolverResult[]
  status: 'idle' | 'solving' | 'solved' | 'error'
  error: string | null
}

const SOLUTION_CAPS = [10, 50, 100] as const

export function SolutionsTab({ game, txs, results, status, error }: SolutionsTabProps) {
  const [expandedColoring, setExpandedColoring] = useState<number | null>(null)
  const solutionCap = useUiStore((state) => state.solutionCaps[game.id] ?? DEFAULT_SOLUTION_CAP)
  const setSolutionCap = useUiStore((state) => state.setSolutionCap)
  const visibleResults = results.slice(0, solutionCap)

  if (status === 'error') {
    return (
      <div className="rounded-3xl border border-red-400/40 bg-red-500/10 px-4 py-6 text-sm text-red-100">
        {error ?? 'The solver failed to produce results.'}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-4 shadow-lg shadow-slate-950/30">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Solutions</h2>
            <p className="text-sm text-slate-400">
              Ranked by fitness, then the documented lexicographic tie-breaker.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <span>Display cap</span>
            <select
              aria-label="Display cap"
              className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
              value={solutionCap}
              onChange={(event) =>
                setSolutionCap(game.id, Number(event.target.value) as (typeof SOLUTION_CAPS)[number])
              }
            >
              {SOLUTION_CAPS.map((cap) => (
                <option key={cap} value={cap}>
                  {cap}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {results.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-950/60 px-4 py-8 text-center text-slate-300">
          <div className="text-lg font-semibold text-slate-100">No valid colorings</div>
          <p className="mt-2 text-sm text-slate-400">
            The current blue range and fixed-color constraints exclude every possible assignment.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleResults.map((result, index) => (
            <ColoringRow
              key={result.c}
              game={game}
              txs={txs}
              result={result}
              isTiedWithPrevious={
                index > 0 && visibleResults[index - 1].fitness === result.fitness
              }
              expanded={expandedColoring === result.c}
              onToggle={() =>
                setExpandedColoring((currentColoring) =>
                  currentColoring === result.c ? null : result.c,
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}
