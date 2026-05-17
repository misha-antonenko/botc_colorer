import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { saveTransaction, useGame } from '../../db/queries'
import type {
  Color,
  ConditionalTx,
  DyadicTx,
  Game,
  Transaction,
} from '../../solver/types'
import { PlayerPicker } from './PlayerPicker'

type TransactionMode = 'dyadic' | 'conditional'

interface DyadicDraft {
  active: string
  passive: string
  weight: string
}

interface EquationDraft {
  i: string
  j: string
  weight: string
}

interface ConditionalDraft {
  playerId: string
  color: Color
  equation: EquationDraft
}

interface SignedWeightFieldProps {
  label: string
  value: string
  onChange: (nextValue: string) => void
}

function getDefaultDyadicDraft(game: Game | undefined): DyadicDraft {
  const players = game?.players ?? []

  return {
    active: players[0]?.id ?? '',
    passive: players[1]?.id ?? players[0]?.id ?? '',
    weight: '1',
  }
}

function getDefaultConditionalDraft(game: Game | undefined): ConditionalDraft {
  const players = game?.players ?? []

  return {
    playerId: players[0]?.id ?? '',
    color: 'blue',
    equation: {
      i: players[0]?.id ?? '',
      j: players[1]?.id ?? players[0]?.id ?? '',
      weight: '1',
    },
  }
}

function parseWeight(value: string): number | null {
  const parsed = Number(value)

  if (!Number.isFinite(parsed) || parsed === 0) {
    return null
  }

  return parsed
}

function isNegativeWeight(value: string): boolean {
  return value.trim().startsWith('-')
}

function getWeightMagnitude(value: string): string {
  return value.trim().replace(/^[+-]/, '')
}

function normalizeMagnitudeInput(value: string): string | null {
  const normalized = value.replace(',', '.')
  return /^(\d+(\.\d*)?|\.\d*|)$/.test(normalized) ? normalized : null
}

function updateWeightMagnitude(currentValue: string, nextMagnitudeValue: string): string {
  const normalizedMagnitude = normalizeMagnitudeInput(nextMagnitudeValue)

  if (normalizedMagnitude === null) {
    return currentValue
  }

  if (normalizedMagnitude === '') {
    return ''
  }

  return `${isNegativeWeight(currentValue) ? '-' : ''}${normalizedMagnitude}`
}

function toggleWeightSign(currentValue: string): string {
  const magnitude = getWeightMagnitude(currentValue)

  if (magnitude === '') {
    return isNegativeWeight(currentValue) ? '1' : '-1'
  }

  return isNegativeWeight(currentValue) ? magnitude : `-${magnitude}`
}

function SignedWeightField({ label, value, onChange }: SignedWeightFieldProps) {
  const negative = isNegativeWeight(value)

  return (
    <div className="flex items-end gap-2">
      <label className="flex min-w-0 flex-1 flex-col gap-2 text-sm text-slate-300">
        <span>{label}</span>
        <input
          aria-label={label}
          className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-base text-slate-100"
          type="text"
          inputMode="decimal"
          pattern="[0-9]*[.,]?[0-9]*"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          value={getWeightMagnitude(value)}
          onChange={(event) => onChange(updateWeightMagnitude(value, event.target.value))}
        />
      </label>
      <button
        type="button"
        aria-label={`${label} sign toggle`}
        className="mb-0.5 min-w-24 rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
        onClick={() => onChange(toggleWeightSign(value))}
      >
        {negative ? 'Oppose' : 'Support'}
      </button>
    </div>
  )
}

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
  const [mode, setMode] = useState<TransactionMode>('dyadic')
  const [dyadicDraft, setDyadicDraft] = useState<DyadicDraft>(() => getDefaultDyadicDraft(game))
  const [conditionalDraft, setConditionalDraft] = useState<ConditionalDraft>(() =>
    getDefaultConditionalDraft(game),
  )
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const validationError = useMemo(() => {
    if (game.players.length < 2) {
      return 'Add at least two players before creating a transaction.'
    }

    if (mode === 'dyadic') {
      if (dyadicDraft.active === '' || dyadicDraft.passive === '') {
        return 'Pick both players.'
      }

      if (dyadicDraft.active === dyadicDraft.passive) {
        return 'Dyadic transactions cannot target the same player twice.'
      }

      if (parseWeight(dyadicDraft.weight) === null) {
        return 'Dyadic weight must be a nonzero number.'
      }

      return null
    }

    if (conditionalDraft.playerId === '') {
      return 'Pick the conditioning player.'
    }

    if (conditionalDraft.equation.i === '' || conditionalDraft.equation.j === '') {
      return 'Pick both players for the conditional equation.'
    }

    if (conditionalDraft.equation.i === conditionalDraft.equation.j) {
      return 'Conditional equations cannot target the same player twice.'
    }

    if (parseWeight(conditionalDraft.equation.weight) === null) {
      return 'Conditional equation weight must be a nonzero number.'
    }

    return null
  }, [conditionalDraft, dyadicDraft, game, mode])

  async function handleSave(): Promise<void> {
    if (validationError !== null) {
      return
    }

    const now = Date.now()
    const normalizedNote = note.trim()
    let transaction: Transaction

    if (mode === 'dyadic') {
      transaction = {
        id: crypto.randomUUID(),
        kind: 'dyadic',
        gameId: game.id,
        createdAt: now,
        enabled: true,
        active: dyadicDraft.active,
        passive: dyadicDraft.passive,
        weight: parseWeight(dyadicDraft.weight)!,
        note: normalizedNote === '' ? undefined : normalizedNote,
      } satisfies DyadicTx
    } else {
      transaction = {
        id: crypto.randomUUID(),
        kind: 'conditional',
        gameId: game.id,
        createdAt: now,
        enabled: true,
        condition: {
          playerId: conditionalDraft.playerId,
          color: conditionalDraft.color,
        },
        equations: [
          {
            i: conditionalDraft.equation.i,
            j: conditionalDraft.equation.j,
            weight: parseWeight(conditionalDraft.equation.weight)!,
          },
        ],
        note: normalizedNote === '' ? undefined : normalizedNote,
      } satisfies ConditionalTx
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
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <div className="safe-bottom w-full max-w-2xl rounded-t-3xl border border-slate-800 bg-slate-950 px-4 py-5 shadow-2xl shadow-slate-950/80">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Add transaction</h2>
            <p className="text-sm text-slate-400">Create a dyadic or conditional observation.</p>
          </div>
          <button
            type="button"
            className="rounded-full border border-slate-700 px-3 py-2 text-sm text-slate-200"
            onClick={() => navigate(`/g/${game.id}`)}
          >
            Close
          </button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-1">
          <button
            type="button"
            className={`rounded-xl px-3 py-2 text-sm font-medium ${
              mode === 'dyadic'
                ? 'bg-slate-200 text-slate-950'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
            onClick={() => setMode('dyadic')}
          >
            Dyadic
          </button>
          <button
            type="button"
            className={`rounded-xl px-3 py-2 text-sm font-medium ${
              mode === 'conditional'
                ? 'bg-slate-200 text-slate-950'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
            onClick={() => setMode('conditional')}
          >
            Conditional
          </button>
        </div>

        <div className="space-y-4">
          {mode === 'dyadic' ? (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <PlayerPicker
                  label="Active player"
                  players={game.players}
                  value={dyadicDraft.active}
                  onChange={(active) =>
                    setDyadicDraft((currentDraft) => ({ ...currentDraft, active }))
                  }
                />
                <PlayerPicker
                  label="Passive player"
                  players={game.players}
                  value={dyadicDraft.passive}
                  onChange={(passive) =>
                    setDyadicDraft((currentDraft) => ({ ...currentDraft, passive }))
                  }
                />
              </div>

              <SignedWeightField
                label="Signed weight"
                value={dyadicDraft.weight}
                onChange={(weight) =>
                  setDyadicDraft((currentDraft) => ({
                    ...currentDraft,
                    weight,
                  }))
                }
              />
            </>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <PlayerPicker
                  label="Conditioning player"
                  players={game.players}
                  value={conditionalDraft.playerId}
                  onChange={(playerId) =>
                    setConditionalDraft((currentDraft) => ({ ...currentDraft, playerId }))
                  }
                />
                <label className="flex flex-col gap-2 text-sm text-slate-300">
                  <span>Conditioning color</span>
                  <select
                    aria-label="Conditioning color"
                    className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-base text-slate-100"
                    value={conditionalDraft.color}
                    onChange={(event) =>
                      setConditionalDraft((currentDraft) => ({
                        ...currentDraft,
                        color: event.target.value as Color,
                      }))
                    }
                  >
                    <option value="blue">Blue</option>
                    <option value="red">Red</option>
                  </select>
                </label>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
                <div className="mb-3 text-sm font-medium text-slate-100">Equation</div>
                <div className="grid gap-3 md:grid-cols-3">
                  <PlayerPicker
                    label="Player i"
                    players={game.players}
                    value={conditionalDraft.equation.i}
                    onChange={(i) =>
                      setConditionalDraft((currentDraft) => ({
                        ...currentDraft,
                        equation: {
                          ...currentDraft.equation,
                          i,
                        },
                      }))
                    }
                  />
                  <PlayerPicker
                    label="Player j"
                    players={game.players}
                    value={conditionalDraft.equation.j}
                    onChange={(j) =>
                      setConditionalDraft((currentDraft) => ({
                        ...currentDraft,
                        equation: {
                          ...currentDraft.equation,
                          j,
                        },
                      }))
                    }
                  />
                  <SignedWeightField
                    label="Equation signed weight"
                    value={conditionalDraft.equation.weight}
                    onChange={(weight) =>
                      setConditionalDraft((currentDraft) => ({
                        ...currentDraft,
                        equation: {
                          ...currentDraft.equation,
                          weight,
                        },
                      }))
                    }
                  />
                </div>
              </div>
            </>
          )}

          <label className="flex flex-col gap-2 text-sm text-slate-300">
            <span>Note</span>
            <textarea
              aria-label="Note"
              className="min-h-24 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-base text-slate-100"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
        </div>

        {validationError === null ? null : (
          <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-200">
            {validationError}
          </div>
        )}
        {error === null ? null : (
          <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-200">
            {error}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200"
            onClick={() => navigate(`/g/${game.id}`)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-full bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            disabled={validationError !== null || saving}
            onClick={() => void handleSave()}
          >
            {saving ? 'Saving…' : 'Save transaction'}
          </button>
        </div>
      </div>
    </div>
  )
}
