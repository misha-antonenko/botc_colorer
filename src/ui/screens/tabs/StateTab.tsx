import type { Game, Transaction } from '../../../solver/types'
import { summarizeTransaction } from '../../formatters'

interface StateTabProps {
  game: Game
  txs: Transaction[]
}

export function StateTab({ game, txs }: StateTabProps) {
  const enabledTxs = txs.filter((tx) => tx.enabled)
  const hardTxs = enabledTxs.filter((tx) => tx.hard)
  const softTxs = enabledTxs.filter((tx) => !tx.hard)

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-mist-800 bg-mist-950/80 p-4 shadow-lg shadow-mist-950/30">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-mist-100">Hard constraints</h2>
          <p className="text-sm text-mist-400">
            Formulas that must be satisfied. Violating colorings are pruned.
          </p>
        </div>

        {hardTxs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-mist-700 px-4 py-6 text-sm text-mist-400">
            No hard constraints.
          </div>
        ) : (
          <div className="space-y-2">
            {hardTxs.map((tx) => (
              <div
                key={tx.id}
                className="rounded-2xl border border-mist-800 bg-mist-900/70 px-3 py-3 text-sm text-mist-200"
              >
                {tx.formula}
                {tx.note !== undefined && (
                  <div className="mt-1 font-sans text-xs italic text-mist-500">{tx.note}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-mist-800 bg-mist-950/80 p-4 shadow-lg shadow-mist-950/30">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-mist-100">Soft constraints</h2>
          <p className="text-sm text-mist-400">
            Weighted formulas that contribute to the fitness score.
          </p>
        </div>

        {softTxs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-mist-700 px-4 py-6 text-sm text-mist-400">
            No soft constraints.
          </div>
        ) : (
          <div className="space-y-2">
            {softTxs.map((tx) => (
              <div
                key={tx.id}
                className="rounded-2xl border border-mist-800 bg-mist-900/70 px-3 py-3 text-sm text-mist-200"
              >
                {summarizeTransaction(game, tx)}
                {tx.note !== undefined && (
                  <div className="mt-1 text-xs italic text-mist-500">{tx.note}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
