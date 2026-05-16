import type { Game, Transaction } from '../../../solver/types'
import { summarizeTransaction, getPlayerName } from '../../formatters'
import { FMatrix } from '../../components/FMatrix'
import { buildStateMatrixData, formatMatrixCellValue } from '../../components/fMatrixUtils'

interface StateTabProps {
  game: Game
  txs: Transaction[]
}

export function StateTab({ game, txs }: StateTabProps) {
  const conditionalTransactions = txs.filter(
    (transaction) => transaction.enabled && transaction.kind === 'conditional',
  )
  const stateMatrix = buildStateMatrixData(game, txs)

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-4 shadow-lg shadow-slate-950/30">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-100">f matrix</h2>
          <p className="text-sm text-slate-400">
            Directed dyadic weights with symmetric conditional contribution ranges.
          </p>
        </div>
        <FMatrix game={game} txs={txs} />
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-4 shadow-lg shadow-slate-950/30">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-100">Conditional list</h2>
          <p className="text-sm text-slate-400">
            Enabled conditional observations that feed the bracketed ranges in the matrix.
          </p>
        </div>

        {conditionalTransactions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 px-4 py-6 text-sm text-slate-400">
            No enabled conditional transactions.
          </div>
        ) : (
          <div className="space-y-2">
            {conditionalTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/70 px-3 py-3 text-sm text-slate-200"
              >
                {summarizeTransaction(game, transaction)}
              </div>
            ))}
          </div>
        )}
      </section>

      <details className="rounded-3xl border border-slate-800 bg-slate-950/80 p-4 shadow-lg shadow-slate-950/30">
        <summary className="cursor-pointer text-lg font-semibold text-slate-100">
          Effective symmetric pair weights
        </summary>
        <div className="mt-4 space-y-2">
          {stateMatrix.symmetricPairs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 px-4 py-6 text-sm text-slate-400">
              No effective pair weights yet.
            </div>
          ) : (
            stateMatrix.symmetricPairs.map((pair) => (
              <div
                key={`${pair.i}:${pair.j}`}
                className="rounded-2xl border border-slate-800 bg-slate-900/70 px-3 py-3 text-sm text-slate-200"
              >
                <div className="font-medium text-slate-100">
                  {getPlayerName(game, game.players[pair.i].id)} ↔ {getPlayerName(game, game.players[pair.j].id)}
                </div>
                <div className="mt-1 font-mono text-slate-300">
                  {formatMatrixCellValue(pair.dyadicWeight, pair.range)}
                </div>
              </div>
            ))
          )}
        </div>
      </details>
    </div>
  )
}
