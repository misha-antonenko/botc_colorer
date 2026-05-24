import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { saveTransaction, useGame } from '../../db/queries'
import type {
  Color,
  ColorTx,
  ConditionalTx,
  DyadicTx,
  Game,
  Transaction,
} from '../../solver/types'
import { PlayerPicker } from './PlayerPicker'

type TransactionMode = 'dyadic' | 'color' | 'conditional'

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

interface ColorDraft {
  playerId: string
  color: Color
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
  toggleLabel: string
}

function getDefaultDyadicDraft(game: Game | undefined): DyadicDraft {
  const players = game?.players ?? []

  return {
    active: players[0]?.id ?? '',
    passive: players[1]?.id ?? players[0]?.id ?? '',
    weight: '1',
  }
}

function getDefaultColorDraft(game: Game | undefined): ColorDraft {
  const players = game?.players ?? []

  return {
    playerId: players[0]?.id ?? '',
    color: 'blue',
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

function SignedWeightField({ label, value, onChange, toggleLabel }: SignedWeightFieldProps) {
  const negative = isNegativeWeight(value)

  return (
    <div className="flex items-end gap-2">
      <label className="flex min-w-0 flex-1 flex-col gap-2 text-sm text-mist-300">
        <span>{label}</span>
        <input
          aria-label={label}
          className="rounded-xl border border-mist-700 bg-mist-900 px-3 py-2 text-base text-mist-100"
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
        aria-label={toggleLabel}
        className="mb-0.5 min-w-24 rounded-xl border border-mist-600 bg-mist-800 px-3 py-2 text-sm text-mist-100"
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
  const [colorDraft, setColorDraft] = useState<ColorDraft>(() => getDefaultColorDraft(game))
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

    if (mode === 'color') {
      if (colorDraft.playerId === '') {
        return 'Pick a player.'
      }

      return null
    }

    if (conditionalDraft.playerId === '') {
      return 'Pick the player for the condition.'
    }

    if (conditionalDraft.equation.i === '' || conditionalDraft.equation.j === '') {
      return 'Pick both players for the then clause.'
    }

    if (conditionalDraft.equation.i === conditionalDraft.equation.j) {
      return 'Conditional equations cannot target the same player twice.'
    }

    if (parseWeight(conditionalDraft.equation.weight) === null) {
      return 'Conditional weight must be a nonzero number.'
    }

    return null
  }, [colorDraft, conditionalDraft, dyadicDraft, game, mode])

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
    } else if (mode === 'color') {
      transaction = {
        id: crypto.randomUUID(),
        kind: 'color',
        gameId: game.id,
        createdAt: now,
        enabled: true,
        playerId: colorDraft.playerId,
        color: colorDraft.color,
        note: normalizedNote === '' ? undefined : normalizedNote,
      } satisfies ColorTx
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
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-mist-950/75 p-4 backdrop-blur-sm">
      <div className="safe-bottom w-full max-w-2xl rounded-t-3xl border border-mist-800 bg-mist-950 px-4 py-5 shadow-2xl shadow-mist-950/80">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-mist-100">Add transaction</h2>
            <p className="text-sm text-mist-400">Create a dyadic, color, or conditional observation.</p>
          </div>
          <button
            type="button"
            className="rounded-full border border-mist-700 px-3 py-2 text-sm text-mist-200"
            onClick={() => navigate(`/g/${game.id}`)}
          >
            Close
          </button>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2 rounded-2xl border border-mist-800 bg-mist-900/70 p-1">
          <button
            type="button"
            className={`rounded-xl px-3 py-2 text-sm font-medium ${
              mode === 'dyadic'
                ? 'bg-mist-200 text-mist-950'
                : 'text-mist-300 hover:bg-mist-800'
            }`}
            onClick={() => setMode('dyadic')}
          >
            Dyadic
          </button>
          <button
            type="button"
            className={`rounded-xl px-3 py-2 text-sm font-medium ${
              mode === 'color'
                ? 'bg-mist-200 text-mist-950'
                : 'text-mist-300 hover:bg-mist-800'
            }`}
            onClick={() => setMode('color')}
          >
            Color
          </button>
          <button
            type="button"
            className={`rounded-xl px-3 py-2 text-sm font-medium ${
              mode === 'conditional'
                ? 'bg-mist-200 text-mist-950'
                : 'text-mist-300 hover:bg-mist-800'
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
                label="Weight"
                toggleLabel="Toggle dyadic weight sign"
                value={dyadicDraft.weight}
                onChange={(weight) =>
                  setDyadicDraft((currentDraft) => ({
                    ...currentDraft,
                    weight,
                  }))
                }
              />
            </>
          ) : mode === 'color' ? (
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <PlayerPicker
                label="Player"
                players={game.players}
                value={colorDraft.playerId}
                onChange={(playerId) =>
                  setColorDraft((currentDraft) => ({ ...currentDraft, playerId }))
                }
              />
              <label className="flex flex-col gap-2 text-sm text-mist-300">
                <span>is</span>
                <select
                  aria-label="Color"
                  className="rounded-xl border border-mist-700 bg-mist-900 px-3 py-2 text-base text-mist-100"
                  value={colorDraft.color}
                  onChange={(event) =>
                    setColorDraft((currentDraft) => ({
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
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <PlayerPicker
                  label="If player"
                  players={game.players}
                  value={conditionalDraft.playerId}
                  onChange={(playerId) =>
                    setConditionalDraft((currentDraft) => ({ ...currentDraft, playerId }))
                  }
                />
                <label className="flex flex-col gap-2 text-sm text-mist-300">
                  <span>is</span>
                  <select
                    aria-label="is"
                    className="rounded-xl border border-mist-700 bg-mist-900 px-3 py-2 text-base text-mist-100"
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

              <div className="rounded-2xl border border-mist-800 bg-mist-900/70 p-3">
                <div className="mb-3 text-sm font-medium text-mist-100">then</div>
                <div className="grid gap-3 md:grid-cols-3">
                  <PlayerPicker
                    label="Active player"
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
                    label="Passive player"
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
                    label="Weight"
                    toggleLabel="Toggle conditional weight sign"
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
            {saving ? 'Saving…' : 'Save transaction'}
          </button>
        </div>
      </div>
    </div>
  )
}
