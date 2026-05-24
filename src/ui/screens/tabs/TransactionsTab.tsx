import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { deleteTransaction, saveTransaction, toggleTransaction } from '../../../db/queries'
import type { Game, Transaction } from '../../../solver/types'
import {
  formatConditionSummary,
  formatSignedNumber,
  getPlayerName,
  summarizeTransaction,
} from '../../formatters'
import { SwipeActionRow } from '../../components/SwipeActionRow'

interface TransactionsTabProps {
  game: Game
  txs: Transaction[]
}

interface UndoState {
  tx: Transaction
}

function parseEditableWeight(value: string): number | null {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed === 0) return null
  return parsed
}

interface WeightEditorProps {
  weight: number
  onCommit: (next: number) => void
}

function WeightEditor({ weight, onCommit }: WeightEditorProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  function start() {
    setDraft(String(weight))
    setEditing(true)
  }

  function commit() {
    setEditing(false)
    const parsed = parseEditableWeight(draft)
    if (parsed !== null && parsed !== weight) {
      onCommit(parsed)
    }
  }

  if (editing) {
    return (
      <input
        autoFocus
        aria-label="Edit weight"
        className="inline w-16 rounded border border-zinc-600 bg-zinc-800 px-1 py-0 text-sm text-zinc-100"
        type="text"
        inputMode="decimal"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') {
            setEditing(false)
          }
        }}
      />
    )
  }

  return (
    <button
      type="button"
      title="Tap to edit weight"
      className="rounded px-0.5 text-zinc-200 underline decoration-dotted underline-offset-2 hover:bg-zinc-700"
      onClick={start}
    >
      {formatSignedNumber(weight)}
    </button>
  )
}

interface NoteEditorProps {
  transaction: Transaction
  isEnabled: boolean
}

function NoteEditor({ transaction, isEnabled }: NoteEditorProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  function startEditing() {
    setDraft(transaction.note ?? '')
    setEditing(true)
  }

  async function commit() {
    setEditing(false)
    const normalized = draft.trim()
    const nextNote = normalized === '' ? undefined : normalized
    if (nextNote !== transaction.note) {
      await saveTransaction({ ...transaction, note: nextNote })
    }
  }

  if (editing) {
    return (
      <textarea
        autoFocus
        aria-label="Edit note"
        className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs leading-5 text-zinc-200"
        rows={3}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setEditing(false)
        }}
      />
    )
  }

  if (transaction.note !== undefined) {
    return (
      <div
        role="button"
        tabIndex={0}
        title="Tap to edit note"
        className={`mt-1 cursor-text whitespace-pre-wrap text-xs leading-5 ${
          isEnabled ? 'text-zinc-400' : 'text-zinc-500 line-through'
        }`}
        onClick={startEditing}
        onKeyDown={(e) => {
          if (e.key === 'Enter') startEditing()
        }}
      >
        {transaction.note}
      </div>
    )
  }

  return (
    <div
      role="button"
      tabIndex={0}
      title="Add a note"
      className="mt-1 cursor-text text-xs leading-5 text-zinc-600 hover:text-zinc-500"
      onClick={startEditing}
      onKeyDown={(e) => {
        if (e.key === 'Enter') startEditing()
      }}
    >
      Add a note…
    </div>
  )
}

interface TransactionSummaryProps {
  game: Game
  transaction: Transaction
  isEnabled: boolean
  onWeightCommit: (getNext: (tx: Transaction) => Transaction) => void
}

function TransactionSummary({ game, transaction, isEnabled, onWeightCommit }: TransactionSummaryProps) {
  const textClass = isEnabled ? 'text-zinc-200' : 'line-through text-zinc-500'

  if (transaction.kind === 'dyadic') {
    return (
      <div className={`text-sm leading-5 ${textClass}`}>
        {getPlayerName(game, transaction.active)}
        {' → '}
        {getPlayerName(game, transaction.passive)}
        {', w = '}
        <WeightEditor
          weight={transaction.weight}
          onCommit={(w) => onWeightCommit((tx) => ({ ...tx, weight: w } as typeof transaction))}
        />
      </div>
    )
  }

  const conditionStr = formatConditionSummary(
    game,
    transaction.condition.playerId,
    transaction.condition.color,
  )

  return (
    <div className={`text-sm leading-5 ${textClass}`}>
      {conditionStr}
      {': '}
      {transaction.equations.map((eq, index) => (
        <span key={index}>
          {index > 0 ? '; ' : ''}
          {getPlayerName(game, eq.i)}
          {eq.weight > 0 ? ' = ' : ' ≠ '}
          {getPlayerName(game, eq.j)}
          {', w = '}
          <WeightEditor
            weight={eq.weight}
            onCommit={(w) =>
              onWeightCommit((tx) => {
                if (tx.kind !== 'conditional') return tx
                const nextEquations = tx.equations.map((e, i) =>
                  i === index ? { ...e, weight: w } : e,
                )
                return { ...tx, equations: nextEquations }
              })
            }
          />
        </span>
      ))}
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
        <div className="rounded-3xl border border-dashed border-zinc-700 bg-zinc-950/60 px-4 py-8 text-center text-zinc-300">
          <div className="text-lg font-semibold text-zinc-100">No transactions yet</div>
          <p className="mt-2 text-sm text-zinc-400">
            Add dyadic or conditional observations to populate the matrix and solutions tabs.
          </p>
        </div>
      ) : (
        txs.map((transaction) => {
          const isEnabled = optimisticEnabled[transaction.id] ?? transaction.enabled

          async function handleWeightCommit(getNext: (tx: Transaction) => Transaction) {
            try {
              await saveTransaction(getNext(transaction))
            } catch (saveError) {
              setError(
                saveError instanceof Error ? saveError.message : 'Failed to update weight.',
              )
            }
          }

          return (
            <SwipeActionRow
              key={transaction.id}
              deleteLabel={`Delete ${summarizeTransaction(game, transaction)}`}
              onDelete={() => void handleDelete(transaction.id)}
            >
              <article className="rounded-3xl border border-zinc-800 bg-zinc-950/80 px-3 py-3 shadow-lg shadow-zinc-950/30">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <TransactionSummary
                      game={game}
                      transaction={transaction}
                      isEnabled={isEnabled}
                      onWeightCommit={(getNext) => void handleWeightCommit(getNext)}
                    />
                    <NoteEditor transaction={transaction} isEnabled={isEnabled} />
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
