import type { Game, Transaction } from '../../../solver/types'
import { summarizeTransaction } from '../../formatters'
import { FMatrix } from '../../components/FMatrix'

interface StateTabProps {
  game: Game
  txs: Transaction[]
}

export function StateTab({ game, txs }: StateTabProps) {
  const conditionalTransactions = txs.filter(
    (transaction) => transaction.enabled && transaction.kind === 'conditional',
  )

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-mist-800 bg-mist-950/80 p-4 shadow-lg shadow-mist-950/30">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-mist-100">Interaction matrix</h2>
          <p className="text-sm text-mist-400">
            Dyadic weights with conditional contribution ranges.
          </p>
        </div>
        <FMatrix game={game} txs={txs} />
      </section>

      <section className="rounded-3xl border border-mist-800 bg-mist-950/80 p-4 shadow-lg shadow-mist-950/30">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-mist-100">Conditional transactions</h2>
          <p className="text-sm text-mist-400">
            Enabled conditional transactions that feed the bracketed ranges in the matrix.
          </p>
        </div>

        {conditionalTransactions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-mist-700 px-4 py-6 text-sm text-mist-400">
            No enabled conditional transactions.
          </div>
        ) : (
          <div className="space-y-2">
            {conditionalTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="rounded-2xl border border-mist-800 bg-mist-900/70 px-3 py-3 text-sm text-mist-200"
              >
                {summarizeTransaction(game, transaction)}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
