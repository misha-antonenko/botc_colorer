import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { saveTransaction, useGame } from '../../db/queries'
import { formatFormula, resolveFormula, validateFormula } from '../../solver/formula'
import type { Game, LogicalTx } from '../../solver/types'

export function AddTransactionSheet() {
  const { gameId } = useParams()
  const game = useGame(gameId)

  if (game === undefined || game === null) {
    return null
  }

  return (
    <AddTransactionSheetForm
      key={`${game.id}:${game.players.map((player) => player.id).join(':')}`}
      game={game}
    />
  )
}

function AddTransactionSheetForm({ game }: { game: Game }) {
  const navigate = useNavigate()
  const [formula, setFormula] = useState('')
  const [hard, setHard] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const validationError = useMemo(() => {
    if (game.players.length < 1) {
      return 'Add at least one player before creating a transaction.'
    }

    const trimmedFormula = formula.trim()
    if (trimmedFormula === '') {
      return 'Enter a formula.'
    }

    const result = validateFormula(trimmedFormula, game.players)
    if (!result.ok) {
      return result.error
    }

    return null
  }, [formula, game.players])

  async function handleSave(): Promise<void> {
    if (validationError !== null) {
      return
    }

    const now = Date.now()
    const normalizedNote = note.trim()
    const resolved = resolveFormula(formula.trim(), game.players)
    const formattedFormula = formatFormula(resolved.ast, resolved.playerMap)

    const transaction: LogicalTx = {
      id: crypto.randomUUID(),
      kind: 'logical',
      gameId: game.id,
      createdAt: now,
      enabled: true,
      formula: formattedFormula,
      weight: 1,
      hard,
      note: normalizedNote === '' ? undefined : normalizedNote,
    }

    setSaving(true)
    setError(null)

    try {
      await saveTransaction(transaction)
      navigate(`/g/${game.id}`)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save transaction.')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-mist-950/75 p-4 backdrop-blur-sm">
      <div className="safe-bottom w-full max-w-2xl rounded-t-3xl border border-mist-800 bg-mist-950 px-4 py-5 shadow-2xl shadow-mist-950/80">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-mist-100">Add transaction</h2>
            <p className="text-sm text-mist-400">
              Enter a logical formula over player names.
            </p>
          </div>
          <button
            type="button"
            className="rounded-full border border-mist-700 px-3 py-2 text-sm text-mist-200"
            onClick={() => navigate(`/g/${game.id}`)}
          >
            Close
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex items-end gap-2">
            <label className="flex min-w-0 flex-1 flex-col gap-2 text-sm text-mist-300">
              <span>Formula</span>
              <input
                aria-label="Formula"
                className="rounded-xl border border-mist-700 bg-mist-900 px-3 py-2 font-mono text-base text-mist-100"
                type="text"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="e.g. Alice ^ Bob, ~Carol => (Al = Bob)"
                value={formula}
                onChange={(event) => setFormula(event.target.value)}
              />
            </label>
            <button
              type="button"
              aria-label="Toggle hard constraint"
              className={`mb-0.5 min-w-24 rounded-xl border px-3 py-2 text-sm ${
                hard
                  ? 'border-amber-500 bg-amber-900/50 text-amber-200'
                  : 'border-mist-600 bg-mist-800 text-mist-100'
              }`}
              onClick={() => setHard((h) => !h)}
            >
              {hard ? 'Hard' : 'Soft'}
            </button>
          </div>

          <label className="flex flex-col gap-2 text-sm text-mist-300">
            <span>Note</span>
            <textarea
              aria-label="Note"
              className="min-h-24 rounded-xl border border-mist-700 bg-mist-900 px-3 py-2 text-base text-mist-100"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
        </div>

        <div className="mt-3 rounded-xl border border-mist-800 bg-mist-900/50 px-3 py-2 text-xs text-mist-400">
          <p>
            Operators (by precedence): <code>! ~</code> (not), <code>& *</code> (and),{' '}
            <code>^ + !=</code> (xor), <code>|</code> (or), <code>=</code> (same color),{' '}
            <code>{'=> <='}</code> (implies). Use player name prefixes as variables.
          </p>
        </div>

        {validationError === null ? null : (
          <div className="mt-4 rounded-xl border border-mist-700 bg-mist-900/80 px-3 py-2 text-sm text-mist-200">
            {validationError}
          </div>
        )}
        {error === null ? null : (
          <div className="mt-4 rounded-xl border border-mist-700 bg-mist-900/80 px-3 py-2 text-sm text-mist-200">
            {error}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            className="rounded-full border border-mist-700 px-4 py-2 text-sm text-mist-200"
            onClick={() => navigate(`/g/${game.id}`)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-full bg-mist-200 px-4 py-2 text-sm font-semibold text-mist-950 disabled:cursor-not-allowed disabled:bg-mist-700 disabled:text-mist-400"
            disabled={validationError !== null || saving}
            onClick={() => void handleSave()}
          >
            {saving ? 'Saving...' : 'Save transaction'}
          </button>
        </div>
      </div>
    </div>
  )
}
