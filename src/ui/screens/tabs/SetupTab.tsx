import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useMemo, useState } from 'react'
import { saveGame } from '../../../db/queries'
import { shiftBlueRangeWithPlayerCount } from '../../../solver/blueRange'
import {
  extractVariables,
  parseFormula,
  resolvePlayerPrefix,
  wouldPlayerMakeFormulasAmbiguous,
  wouldRenameMakeFormulasAmbiguous,
} from '../../../solver/formula'
import type { Game, Player, Transaction } from '../../../solver/types'
import { SwipeActionRow } from '../../components/SwipeActionRow'

interface SetupTabProps {
  game: Game
  txs: Transaction[]
}

interface BlueCountInputs {
  min: string
  max: string
}

interface SortablePlayerCardProps {
  player: Player
  index: number
  cannotRemove: boolean
  onNameChange: (name: string) => void
  onRemove: () => void
}

function validateBlueRange(game: Game): string | null {
  if (game.blueCountMin > game.players.length || game.blueCountMax > game.players.length) {
    return 'Blue counts cannot exceed the player count.'
  }

  if (game.blueCountMin > game.blueCountMax) {
    return 'Blue minimum cannot exceed the maximum.'
  }

  return null
}

function parseCountInput(value: string): number | null {
  if (value === '') {
    return null
  }

  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed < 0) {
    return null
  }

  return parsed
}

function isDigitsOnly(value: string): boolean {
  return /^\d*$/.test(value)
}

function clampBlueCount(value: number, playerCount: number): number {
  return Math.max(0, Math.min(value, playerCount))
}

function reorderPlayers(players: Player[], activeId: string, overId: string): Player[] {
  const activeIndex = players.findIndex((player) => player.id === activeId)
  const overIndex = players.findIndex((player) => player.id === overId)

  if (activeIndex === -1 || overIndex === -1 || activeIndex === overIndex) {
    return players
  }

  return arrayMove(players, activeIndex, overIndex)
}

function SortablePlayerCard({
  player,
  index,
  cannotRemove,
  onNameChange,
  onRemove,
}: SortablePlayerCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: player.id })

  return (
    <SwipeActionRow
      actionDisabled={cannotRemove}
      deleteLabel={`Delete seat ${index + 1}`}
      onDelete={onRemove}
    >
      <div
        ref={setNodeRef}
        className={`w-full min-w-0 rounded-2xl border border-mist-800 bg-mist-900/70 p-2.5 ${
          isDragging ? 'shadow-2xl shadow-mist-950/60 ring-1 ring-mist-400/30' : ''
        }`}
        style={{
          transform: CSS.Transform.toString(transform),
          transition,
        }}
      >
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
          <div
            aria-label={`Seat ${index + 1}`}
            className="flex h-10 w-14 shrink-0 flex-col items-center justify-center rounded-xl border border-mist-700 bg-mist-950 text-[10px] leading-tight text-mist-400"
          >
            <span className="uppercase tracking-wide">Seat</span>
            <span className="text-sm font-semibold text-mist-200">{index + 1}</span>
          </div>

          <div className="min-w-0 flex-1">
            <input
              aria-label={`Player ${index + 1} name`}
              className="min-w-0 w-full rounded-xl border border-mist-700 bg-mist-950 px-3 py-2 text-base text-mist-100"
              value={player.name}
              onChange={(event) => onNameChange(event.target.value)}
            />
          </div>

          <button
            ref={setActivatorNodeRef}
            type="button"
            aria-label={`Drag seat ${index + 1}`}
            className="touch-none self-stretch rounded-xl border border-mist-700 bg-mist-950 px-3 text-base text-mist-200"
            {...attributes}
            {...listeners}
          >
            ≡
          </button>
        </div>
      </div>
    </SwipeActionRow>
  )
}

export function SetupTab({ game, txs }: SetupTabProps) {
  const [draft, setDraft] = useState(game)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [blueCountInputs, setBlueCountInputs] = useState<BlueCountInputs>({
    min: String(game.blueCountMin),
    max: String(game.blueCountMax),
  })
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  )
  const blueRangeError = validateBlueRange(draft)
  const playerCount = draft.players.length
  const formulas = useMemo(() => txs.map((tx) => tx.formula), [txs])
  const [addPlayerError, setAddPlayerError] = useState<string | null>(null)
  const [renameError, setRenameError] = useState<string | null>(null)

  const referencedPlayerIds = useMemo(() => {
    const ids = new Set<string>()

    for (const tx of txs) {
      try {
        const ast = parseFormula(tx.formula)
        const vars = extractVariables(ast)
        for (const varName of vars) {
          const result = resolvePlayerPrefix(varName, draft.players)
          if (result.ok) {
            ids.add(result.player.id)
          }
        }
      } catch {
        // skip unparseable formulas
      }
    }

    return ids
  }, [txs, draft.players])

  function persist(nextGame: Game, nextBlueCountInputs = blueCountInputs): void {
    setDraft(nextGame)
    setBlueCountInputs(nextBlueCountInputs)

    if (validateBlueRange(nextGame) !== null) {
      return
    }

    void saveGame(nextGame)
      .then(() => setSaveError(null))
      .catch((error) => {
        setSaveError(error instanceof Error ? error.message : 'Failed to save setup changes.')
      })
  }

  function updateDraft(updater: (currentDraft: Game) => Game): void {
    persist(updater(draft))
  }

  function updateBlueCount(field: 'blueCountMin' | 'blueCountMax', value: string): void {
    if (!isDigitsOnly(value)) {
      return
    }

    const nextBlueCountInputs =
      field === 'blueCountMin'
        ? { ...blueCountInputs, min: value }
        : { ...blueCountInputs, max: value }

    setBlueCountInputs(nextBlueCountInputs)

    const parsed = parseCountInput(value)

    if (parsed === null || parsed > playerCount) {
      return
    }

    persist(
      {
        ...draft,
        [field]: parsed,
      },
      nextBlueCountInputs,
    )
  }

  function normalizeBlueCount(field: 'blueCountMin' | 'blueCountMax'): void {
    const key = field === 'blueCountMin' ? 'min' : 'max'
    const currentValue = blueCountInputs[key]
    const parsed = parseCountInput(currentValue)

    if (parsed === null) {
      setBlueCountInputs({
        ...blueCountInputs,
        [key]: String(draft[field]),
      })
      return
    }

    const normalized = clampBlueCount(parsed, playerCount)

    const nextBlueCountInputs = {
      ...blueCountInputs,
      [key]: String(normalized),
    }

    persist(
      {
        ...draft,
        [field]: normalized,
      },
      nextBlueCountInputs,
    )
  }

  function handlePlayerDragEnd(event: DragEndEvent): void {
    const { active, over } = event

    if (over === null || active.id === over.id) {
      return
    }

    updateDraft((currentDraft) => ({
      ...currentDraft,
      players: reorderPlayers(
        currentDraft.players,
        String(active.id),
        String(over.id),
      ),
    }))
  }

  function persistWithShiftedBlueRange(nextPlayers: Player[]): void {
    const nextRange = shiftBlueRangeWithPlayerCount(
      draft.blueCountMin,
      draft.blueCountMax,
      draft.players.length,
      nextPlayers.length,
    )
    const nextBlueCountInputs = {
      min: String(nextRange.min),
      max: String(nextRange.max),
    }

    persist(
      {
        ...draft,
        players: nextPlayers,
        blueCountMin: nextRange.min,
        blueCountMax: nextRange.max,
      },
      nextBlueCountInputs,
    )
  }

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-mist-800 bg-mist-950/80 p-4 shadow-lg shadow-mist-950/30">
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <label className="flex flex-col gap-2 text-sm text-mist-300">
            <span>Game name</span>
            <input
              aria-label="Game name"
              className="rounded-2xl border border-mist-700 bg-mist-900 px-3 py-2 text-base text-mist-100"
              value={draft.name}
              onChange={(event) =>
                updateDraft((currentDraft) => ({
                  ...currentDraft,
                  name: event.target.value,
                }))
              }
            />
          </label>

          <div className="rounded-2xl border border-mist-800 bg-mist-900/70 p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-mist-100">Blue count range</div>
                <div className="mt-1 text-xs text-mist-400">
                  Shifts automatically when players are added or removed.
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-mist-300">
                  <span>Min</span>
                  <input
                    aria-label="Blue count minimum"
                    className="w-16 rounded-xl border border-mist-700 bg-mist-950 px-3 py-2 text-center text-base text-mist-100"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={blueCountInputs.min}
                    onBlur={() => normalizeBlueCount('blueCountMin')}
                    onChange={(event) =>
                      updateBlueCount('blueCountMin', event.target.value)
                    }
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-mist-300">
                  <span>Max</span>
                  <input
                    aria-label="Blue count maximum"
                    className="w-16 rounded-xl border border-mist-700 bg-mist-950 px-3 py-2 text-center text-base text-mist-100"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={blueCountInputs.max}
                    onBlur={() => normalizeBlueCount('blueCountMax')}
                    onChange={(event) =>
                      updateBlueCount('blueCountMax', event.target.value)
                    }
                  />
                </label>
              </div>
            </div>
            {blueRangeError === null ? null : (
              <div className="mt-3 text-sm text-mist-300">{blueRangeError}</div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-mist-800 bg-mist-950/80 p-4 shadow-lg shadow-mist-950/30">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-mist-100">Players</h2>
          </div>
          <button
            type="button"
            className="rounded-full border border-mist-700 px-4 py-2 text-sm text-mist-200 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={draft.players.length >= 16}
            onClick={() => {
              const newPlayer: Player = {
                id: crypto.randomUUID(),
                name: `Player ${draft.players.length + 1}`,
              }
              const ambiguityError = wouldPlayerMakeFormulasAmbiguous(formulas, draft.players, newPlayer)
              if (ambiguityError !== null) {
                setAddPlayerError(ambiguityError)
                return
              }
              setAddPlayerError(null)
              const nextPlayers = [...draft.players, newPlayer]
              persistWithShiftedBlueRange(nextPlayers)
            }}
          >
            Add player
          </button>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handlePlayerDragEnd}
        >
          <SortableContext
            items={draft.players.map((player) => player.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {draft.players.map((player, index) => {
                const cannotRemove =
                  draft.players.length === 1 || referencedPlayerIds.has(player.id)

                return (
                  <SortablePlayerCard
                    key={player.id}
                    player={player}
                    index={index}
                    cannotRemove={cannotRemove}
                    onNameChange={(name) => {
                      const error = wouldRenameMakeFormulasAmbiguous(
                        formulas,
                        draft.players,
                        player.id,
                        name,
                      )
                      setRenameError(error)
                      if (error !== null) return
                      updateDraft((currentDraft) => ({
                        ...currentDraft,
                        players: currentDraft.players.map((currentPlayer, currentIndex) =>
                          currentIndex === index ? { ...currentPlayer, name } : currentPlayer,
                        ),
                      }))
                    }}
                    onRemove={() => {
                      const nextPlayers = draft.players.filter(
                        (_, currentIndex) => currentIndex !== index,
                      )
                      persistWithShiftedBlueRange(nextPlayers)
                    }}
                  />
                )
              })}
            </div>
          </SortableContext>
        </DndContext>
      </section>

      {addPlayerError === null ? null : (
        <div className="rounded-2xl border border-amber-700 bg-amber-900/30 px-4 py-3 text-sm text-amber-200">
          {addPlayerError}
        </div>
      )}
      {renameError === null ? null : (
        <div className="rounded-2xl border border-amber-700 bg-amber-900/30 px-4 py-3 text-sm text-amber-200">
          {renameError}
        </div>
      )}
      {saveError === null ? null : (
        <div className="rounded-2xl border border-mist-700 bg-mist-900/80 px-4 py-3 text-sm text-mist-200">
          {saveError}
        </div>
      )}
    </div>
  )
}
