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
        <div className="rounded-3xl border border-dashed border-zinc-700 bg-zinc-950/60 px-4 py-8 text-center text-zinc-300">
          <div className="text-lg font-semibold text-zinc-100">No transactions yet</div>
          <p className="mt-2 text-sm text-zinc-400">
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
                className="rounded-3xl border border-zinc-800 bg-zinc-950/80 px-3 py-3 shadow-lg shadow-zinc-950/30"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div
                      className={`text-sm leading-5 text-zinc-200 ${
                        isEnabled ? '' : 'line-through text-zinc-500'
                      }`}
                    >
                      {summarizeTransaction(game, transaction)}
                    </div>
                    {transaction.note === undefined ? null : (
                      <div
                        className={`mt-1 whitespace-pre-wrap text-xs leading-5 ${
                          isEnabled ? 'text-zinc-400' : 'text-zinc-500 line-through'
                        }`}
                      >
                        {transaction.note}
                      </div>
                    )}
                  </div>

                  <label className="inline-flex shrink-0 items-center rounded-md border border-zinc-700 bg-zinc-900/80 p-1.5 text-xs text-zinc-300">
                    <input
                      aria-label="Enabled"
                      type="checkbox"
                      className="h-5 w-5 accent-zinc-300"
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
        <div className="fixed inset-x-4 bottom-24 z-30 rounded-2xl border border-zinc-700 bg-zinc-950/95 px-4 py-3 text-sm text-zinc-200 shadow-2xl shadow-zinc-950/60">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>Transaction deleted. Undo is available for 5 seconds.</span>
            <button
              type="button"
              className="rounded-full bg-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-950"
              onClick={() => void handleUndo()}
            >
              Undo
            </button>
          </div>
        </div>
      )}

      {error === null ? null : (
        <div className="rounded-2xl border border-zinc-700 bg-zinc-900/80 px-4 py-3 text-sm text-zinc-200">
          {error}
        </div>
      )}

      <Link
        aria-label="Add transaction"
        className="fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-200 text-3xl font-semibold text-zinc-950 shadow-2xl shadow-zinc-950/50"
        to={`/g/${game.id}/tx/new`}
      >
        +
      </Link>
    </div>
  )
}
