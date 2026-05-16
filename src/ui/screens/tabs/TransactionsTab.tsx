import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { deleteTransaction, saveTransaction, toggleTransaction } from '../../../db/queries'
import type { Game, Transaction } from '../../../solver/types'
import { summarizeTransaction } from '../../formatters'

interface TransactionsTabProps {
  game: Game
  txs: Transaction[]
}

interface UndoState {
  tx: Transaction
}

interface SwipeActionRowProps {
  children: ReactNode
  deleteLabel: string
  onDelete: () => void
}

const SWIPE_ACTION_WIDTH = 88

function isInteractiveTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    target.closest('button, input, label, a, select, textarea') !== null
  )
}

function SwipeActionRow({ children, deleteLabel, onDelete }: SwipeActionRowProps) {
  const [offset, setOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const pointerIdRef = useRef<number | null>(null)
  const startXRef = useRef(0)
  const startOffsetRef = useRef(0)
  const offsetRef = useRef(0)

  function closeRow(): void {
    offsetRef.current = 0
    setOffset(0)
    setIsDragging(false)
  }

  function openRow(): void {
    offsetRef.current = -SWIPE_ACTION_WIDTH
    setOffset(-SWIPE_ACTION_WIDTH)
    setIsDragging(false)
  }

  function releasePointer(): void {
    pointerIdRef.current = null
    setIsDragging(false)
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>): void {
    if ((event.pointerType === 'mouse' && event.button !== 0) || isInteractiveTarget(event.target)) {
      return
    }

    pointerIdRef.current = event.pointerId
    startXRef.current = event.clientX
    startOffsetRef.current = offsetRef.current
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>): void {
    if (pointerIdRef.current !== event.pointerId) {
      return
    }

    const deltaX = event.clientX - startXRef.current

    if (Math.abs(deltaX) > 4) {
      setIsDragging(true)
    }

    const nextOffset = Math.max(
      -SWIPE_ACTION_WIDTH,
      Math.min(0, startOffsetRef.current + deltaX),
    )

    offsetRef.current = nextOffset
    setOffset(nextOffset)
  }

  function handlePointerEnd(event: React.PointerEvent<HTMLDivElement>): void {
    if (pointerIdRef.current !== event.pointerId) {
      return
    }

    event.currentTarget.releasePointerCapture?.(event.pointerId)
    releasePointer()

    if (offsetRef.current <= -SWIPE_ACTION_WIDTH / 2) {
      openRow()
      return
    }

    closeRow()
  }

  return (
    <div className="relative overflow-hidden rounded-3xl">
      <div className="absolute inset-y-0 right-0 flex w-[88px] items-center justify-center bg-red-500/15">
        <button
          type="button"
          aria-label={deleteLabel}
          className="rounded-full border border-red-400/40 bg-red-500/20 px-3 py-2 text-sm text-red-100 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={offset !== -SWIPE_ACTION_WIDTH}
          onClick={() => {
            closeRow()
            onDelete()
          }}
        >
          Delete
        </button>
      </div>
      <div
        className={`relative touch-pan-y ${isDragging ? '' : 'transition-transform duration-200 ease-out'}`}
        style={{
          transform: `translateX(${offset}px)`,
        }}
        onPointerCancel={closeRow}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
      >
        {children}
      </div>
    </div>
  )
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
                className={`rounded-3xl border border-slate-800 bg-slate-950/80 p-4 shadow-lg shadow-slate-950/30 ${
                  isEnabled ? '' : 'opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-2">
                    <div className={`text-sm text-slate-200 ${isEnabled ? '' : 'line-through'}`}>
                      {summarizeTransaction(game, transaction)}
                    </div>
                    <div className="text-xs text-slate-400">
                      Added {new Date(transaction.createdAt).toLocaleString()}
                    </div>
                  </div>

                  <label className="inline-flex shrink-0 items-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-300">
                    <input
                      aria-label="Enabled"
                      type="checkbox"
                      className="h-4 w-4 accent-blue-500"
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
                    <span>Enabled</span>
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
