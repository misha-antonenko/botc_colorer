import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { deleteTransaction, saveTransaction, toggleTransaction } from '../../../db/queries'
import { formatFormula, resolveFormula, validateFormula } from '../../../solver/formula'
import type { Game, Transaction } from '../../../solver/types'
import { formatWeight, summarizeTransaction } from '../../formatters'
import { SwipeActionRow } from '../../components/SwipeActionRow'

interface TransactionsTabProps {
  game: Game
  txs: Transaction[]
}

interface UndoState {
  tx: Transaction
}

interface FormulaEditorProps {
  game: Game
  transaction: Transaction
  isEnabled: boolean
  validationError: string | null
  onValidationErrorChange: (error: string | null) => void
}

function FormulaEditor({
  game,
  transaction,
  isEnabled,
  validationError,
  onValidationErrorChange,
}: FormulaEditorProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  function startEditing() {
    setDraft(transaction.formula)
    setEditing(true)
    onValidationErrorChange(null)
  }

  async function commit() {
    setEditing(false)
    const trimmed = draft.trim()

    if (trimmed === '' || trimmed === transaction.formula) {
      onValidationErrorChange(null)
      return
    }

    const result = validateFormula(trimmed, game.players)
    if (!result.ok) {
      onValidationErrorChange(result.error)
      return
    }

    const resolved = resolveFormula(trimmed, game.players)
    const formattedFormula = formatFormula(resolved.ast, resolved.playerMap)
    onValidationErrorChange(null)
    await saveTransaction({ ...transaction, formula: formattedFormula })
  }

  const hasError = validationError !== null

  if (editing) {
    return (
      <input
        autoFocus
        aria-label="Edit formula"
        className={`w-full rounded border px-1 py-0  text-sm ${
          hasError
            ? 'border-red-500 bg-red-950/50 text-red-200'
            : 'border-mist-600 bg-mist-800 text-mist-100'
        }`}
        type="text"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') {
            setEditing(false)
            onValidationErrorChange(null)
          }
        }}
      />
    )
  }

  const textClass = hasError
    ? 'text-red-400'
    : isEnabled
      ? 'text-mist-200'
      : 'line-through text-mist-500'

  return (
    <span
      role="button"
      tabIndex={0}
      title="Tap to edit formula"
      className={`cursor-text  underline decoration-dotted underline-offset-2 hover:bg-mist-700/50 ${textClass}`}
      onClick={startEditing}
      onKeyDown={(e) => {
        if (e.key === 'Enter') startEditing()
      }}
    >
      {transaction.formula}
    </span>
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
        className="mt-1 w-full rounded-lg border border-mist-600 bg-mist-800 px-2 py-1 text-xs leading-5 text-mist-200"
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
          isEnabled ? 'text-mist-400' : 'text-mist-500 line-through'
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
      className="mt-1 cursor-text text-xs leading-5 text-mist-600 hover:text-mist-500"
      onClick={startEditing}
      onKeyDown={(e) => {
        if (e.key === 'Enter') startEditing()
      }}
    >
      Add a note...
    </div>
  )
}

interface TransactionSummaryProps {
  game: Game
  transaction: Transaction
  isEnabled: boolean
  validationError: string | null
  onValidationErrorChange: (error: string | null) => void
}

function TransactionSummary({
  game,
  transaction,
  isEnabled,
  validationError,
  onValidationErrorChange,
}: TransactionSummaryProps) {
  const textClass = isEnabled ? 'text-mist-200' : 'line-through text-mist-500'

  return (
    <div className={`text-sm leading-5 ${textClass}`}>
      <FormulaEditor
        game={game}
        transaction={transaction}
        isEnabled={isEnabled}
        validationError={validationError}
        onValidationErrorChange={onValidationErrorChange}
      />
      {transaction.hard ? (
        <button
          type="button"
          title="Tap to make soft"
          className="ml-2 rounded bg-amber-900/50 px-1.5 py-0.5 text-xs text-amber-300 hover:bg-amber-800/50"
          onClick={() => void saveTransaction({ ...transaction, hard: false })}
        >
          hard
        </button>
      ) : (
        <button
          type="button"
          title="Tap to make hard"
          className="ml-2 rounded bg-mist-800 px-1.5 py-0.5 text-xs text-mist-400 hover:bg-mist-700"
          onClick={() => void saveTransaction({ ...transaction, hard: true })}
        >
          soft
        </button>
      )}
      {!transaction.hard && formatWeight(transaction.weight) !== '' ? (
        <span className="ml-1 text-mist-400">{formatWeight(transaction.weight)}</span>
      ) : null}
    </div>
  )
}

export function TransactionsTab({ game, txs }: TransactionsTabProps) {
  const [undoState, setUndoState] = useState<UndoState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [optimisticEnabled, setOptimisticEnabled] = useState<Record<string, boolean>>({})
  const [validationErrors, setValidationErrors] = useState<Record<string, string | null>>({})
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
        <div className="rounded-3xl border border-dashed border-mist-700 bg-mist-950/60 px-4 py-8 text-center text-mist-300">
          <div className="text-lg font-semibold text-mist-100">No transactions yet</div>
          <p className="mt-2 text-sm text-mist-400">
            Add logical statements to constrain the colorings and populate the solutions tab.
          </p>
        </div>
      ) : (
        txs.map((transaction) => {
          const isEnabled = optimisticEnabled[transaction.id] ?? transaction.enabled
          const validationError = validationErrors[transaction.id] ?? null

          return (
            <SwipeActionRow
              key={transaction.id}
              deleteLabel={`Delete ${summarizeTransaction(game, transaction)}`}
              onDelete={() => void handleDelete(transaction.id)}
            >
              <article
                className={`rounded-3xl border bg-mist-950/80 px-3 py-3 shadow-lg shadow-mist-950/30 ${
                  validationError !== null ? 'border-red-700' : 'border-mist-800'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <TransactionSummary
                      game={game}
                      transaction={transaction}
                      isEnabled={isEnabled}
                      validationError={validationError}
                      onValidationErrorChange={(err) =>
                        setValidationErrors((current) => ({ ...current, [transaction.id]: err }))
                      }
                    />
                    {validationError !== null ? (
                      <div className="mt-1 text-xs text-red-400">{validationError}</div>
                    ) : null}
                    <NoteEditor transaction={transaction} isEnabled={isEnabled} />
                  </div>

                  <label className="inline-flex shrink-0 items-center rounded-md border border-mist-700 bg-mist-900/80 p-1.5 text-xs text-mist-300">
                    <input
                      aria-label="Enabled"
                      type="checkbox"
                      className="h-5 w-5 accent-mist-300"
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
        <div className="fixed inset-x-4 bottom-24 z-30 rounded-2xl border border-mist-700 bg-mist-950/95 px-4 py-3 text-sm text-mist-200 shadow-2xl shadow-mist-950/60">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>Transaction deleted. Undo is available for 5 seconds.</span>
            <button
              type="button"
              className="rounded-full bg-mist-200 px-4 py-2 text-sm font-semibold text-mist-950"
              onClick={() => void handleUndo()}
            >
              Undo
            </button>
          </div>
        </div>
      )}

      {error === null ? null : (
        <div className="rounded-2xl border border-mist-700 bg-mist-900/80 px-4 py-3 text-sm text-mist-200">
          {error}
        </div>
      )}

      <Link
        aria-label="Add transaction"
        className="fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-mist-200 text-3xl font-semibold text-mist-950 shadow-2xl shadow-mist-950/50"
        to={`/g/${game.id}/tx/new`}
      >
        +
      </Link>
    </div>
  )
}
