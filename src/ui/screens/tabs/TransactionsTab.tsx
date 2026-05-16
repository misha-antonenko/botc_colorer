import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { deleteTransaction, saveTransaction, toggleTransaction } from '../../../db/queries'
import type { Game, Transaction } from '../../../solver/types'
import { summarizeTransaction } from '../../formatters'
import { SwipeActionRow } from '../../components/SwipeActionRow'

interface TransactionsTabProps {
  game: Game
  txs: Transaction[]
}

interface UndoState {
  tx: Transaction
}

export function TransactionsTab({ game, txs }: TransactionsTabProps) {
  const [undoState, setUndoState] = useState<UndoState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [optimisticEnabled, setOptimisticEnabled] = useState<Record<string, boolean>>({})
  const timeoutRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  async function handleDelete(transactionId: string): Promise<void> {
    const deletedTransaction = await deleteTransaction(transactionId)

    if (deletedTransaction === null) {
      return
    }

    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
    }

    setUndoState({ tx: deletedTransaction })
    timeoutRef.current = window.setTimeout(() => {
      setUndoState(null)
      timeoutRef.current = null
    }, 5000)
  }

  async function handleUndo(): Promise<void> {
    if (undoState === null) {
      return
    }

    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    try {
      await saveTransaction(undoState.tx)
      setUndoState(null)
    } catch (undoError) {
      setError(undoError instanceof Error ? undoError.message : 'Failed to undo deletion.')
    }
  }

  return (
    <div className="space-y-4">
      {txs.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-950/60 px-4 py-8 text-center text-slate-300">
          <div className="text-lg font-semibold text-slate-100">No transactions yet</div>
          <p className="mt-2 text-sm text-slate-400">
            Add dyadic or conditional observations to populate the matrix and solutions tabs.
          </p>
        </div>
      ) : (
        txs.map((transaction) => {
          const isEnabled = optimisticEnabled[transaction.id] ?? transaction.enabled

          return (
            <SwipeActionRow
              key={transaction.id}
              deleteLabel={`Delete ${summarizeTransaction(game, transaction)}`}
              onDelete={() => void handleDelete(transaction.id)}
            >
              <article
                className="rounded-3xl border border-slate-800 bg-slate-950/80 p-4 shadow-lg shadow-slate-950/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div
                      className={`text-sm text-slate-200 ${
                        isEnabled ? '' : 'line-through text-slate-500'
                      }`}
                    >
                      {summarizeTransaction(game, transaction)}
                    </div>
                  </div>

                  <label className="inline-flex shrink-0 items-center rounded-md border border-slate-700 bg-slate-900/80 p-2 text-xs text-slate-300">
                    <input
                      aria-label="Enabled"
                      type="checkbox"
                      className="h-5 w-5 accent-blue-500"
                      checked={isEnabled}
                      onChange={(event) => {
                        const enabled = event.target.checked

                        setOptimisticEnabled((currentState) => ({
                          ...currentState,
                          [transaction.id]: enabled,
                        }))
                        void toggleTransaction(transaction, enabled)
                          .then(() => {
                            setOptimisticEnabled((currentState) => {
                              const nextState = { ...currentState }
                              delete nextState[transaction.id]
                              return nextState
                            })
                          })
                          .catch((toggleError) => {
                            setOptimisticEnabled((currentState) => ({
                              ...currentState,
                              [transaction.id]: transaction.enabled,
                            }))
                            setError(
                              toggleError instanceof Error
                                ? toggleError.message
                                : 'Failed to update transaction state.',
                            )
                          })
                      }}
                    />
                  </label>
                </div>
              </article>
            </SwipeActionRow>
          )
        })
      )}

      {undoState === null ? null : (
        <div className="fixed inset-x-4 bottom-24 z-30 rounded-2xl border border-amber-400/40 bg-slate-950/95 px-4 py-3 text-sm text-slate-200 shadow-2xl shadow-slate-950/60">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>Transaction deleted. Undo is available for 5 seconds.</span>
            <button
              type="button"
              className="rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950"
              onClick={() => void handleUndo()}
            >
              Undo
            </button>
          </div>
        </div>
      )}

      {error === null ? null : (
        <div className="rounded-2xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}

      <Link
        aria-label="Add transaction"
        className="fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-blue-500 text-3xl font-semibold text-white shadow-2xl shadow-blue-500/30"
        to={`/g/${game.id}/tx/new`}
      >
        +
      </Link>
    </div>
  )
}
