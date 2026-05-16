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
import type { Color, Game, Player, Transaction } from '../../../solver/types'
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
  onToggleColor: () => void
  onRemove: () => void
}

function cycleColor(currentColor: Color | null): Color | null {
  if (currentColor === null) {
    return 'blue'
  }

  if (currentColor === 'blue') {
    return 'red'
  }

  return null
}

function validateBlueRange(game: Game): string | null {
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
  onToggleColor,
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
  const fixedColorLabel =
    player.fixedColor === null ? 'Unknown' : player.fixedColor === 'blue' ? 'Blue' : 'Red'

  return (
    <SwipeActionRow
      actionDisabled={cannotRemove}
      deleteLabel={`Delete seat ${index + 1}`}
      onDelete={onRemove}
    >
      <div
        ref={setNodeRef}
        className={`rounded-2xl border border-slate-800 bg-slate-900/70 p-3 ${
          isDragging ? 'shadow-2xl shadow-blue-500/20 ring-1 ring-blue-400/40' : ''
        }`}
        style={{
          transform: CSS.Transform.toString(transform),
          transition,
        }}
      >
        <div className="grid grid-cols-[1fr_auto] items-stretch gap-3">
          <div className="space-y-2">
            <div className="text-xs text-slate-400">Seat {index + 1}</div>
            <div className="flex items-center gap-2">
              <input
                aria-label={`Player ${index + 1} name`}
                className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                value={player.name}
                onChange={(event) => onNameChange(event.target.value)}
              />
              <button
                type="button"
                aria-label={`Seat ${index + 1} fixed color: ${fixedColorLabel}`}
                className={`shrink-0 rounded-xl px-3 py-2 text-sm font-medium ${
                  player.fixedColor === 'blue'
                    ? 'bg-blue-500 text-white'
                    : player.fixedColor === 'red'
                      ? 'bg-red-500 text-white'
                      : 'border border-slate-700 bg-slate-950 text-slate-200'
                }`}
                onClick={onToggleColor}
              >
                {fixedColorLabel}
              </button>
            </div>
          </div>

          <button
            ref={setActivatorNodeRef}
            type="button"
            aria-label={`Drag seat ${index + 1}`}
            className="touch-none self-stretch rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-200"
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
  const referencedPlayerIds = useMemo(() => {
    const ids = new Set<string>()

    for (const transaction of txs) {
      if (transaction.kind === 'dyadic') {
        ids.add(transaction.active)
        ids.add(transaction.passive)
        continue
      }

      ids.add(transaction.condition.playerId)
      transaction.equations.forEach((equation) => {
        ids.add(equation.i)
        ids.add(equation.j)
      })
    }

    return ids
  }, [txs])

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

    if (parsed === null) {
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

    setBlueCountInputs({
      ...blueCountInputs,
      [key]: String(parsed),
    })
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

  const visualSlots = Array.from({ length: draft.players.length }, (_, index) => index)
  const visualMin = Math.max(0, Math.min(draft.blueCountMin, draft.players.length))
  const visualMax = Math.max(0, Math.min(draft.blueCountMax, draft.players.length))

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-4 shadow-lg shadow-slate-950/30">
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            <span>Game name</span>
            <input
              aria-label="Game name"
              className="rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
              value={draft.name}
              onChange={(event) =>
                updateDraft((currentDraft) => ({
                  ...currentDraft,
                  name: event.target.value,
                }))
              }
            />
          </label>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="mb-3 text-sm font-semibold text-slate-100">Blue count range</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm text-slate-300">
                <span>Minimum</span>
                <input
                  aria-label="Blue count minimum"
                  className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
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
              <label className="flex flex-col gap-2 text-sm text-slate-300">
                <span>Maximum</span>
                <input
                  aria-label="Blue count maximum"
                  className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
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
            <div
              className="mt-4 grid gap-2"
              style={{
                gridTemplateColumns: `repeat(${Math.max(draft.players.length, 1)}, minmax(0, 1fr))`,
              }}
            >
              {visualSlots.map((slot) => {
                const isSelected = slot >= visualMin && slot < visualMax

                return (
                  <div
                    key={slot}
                    className={`h-3 rounded-full ${
                      isSelected ? 'bg-blue-500' : 'bg-slate-800'
                    }`}
                  />
                )
              })}
            </div>
            {blueRangeError === null ? null : (
              <div className="mt-3 text-sm text-amber-300">{blueRangeError}</div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-4 shadow-lg shadow-slate-950/30">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Players</h2>
            <p className="text-sm text-slate-400">
              Drag to reorder seats, rename players, and cycle fixed colors.
            </p>
          </div>
          <button
            type="button"
            className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={draft.players.length >= 16}
            onClick={() =>
              updateDraft((currentDraft) => ({
                ...currentDraft,
                players: [
                  ...currentDraft.players,
                  {
                    id: crypto.randomUUID(),
                    name: `Player ${currentDraft.players.length + 1}`,
                    fixedColor: null,
                  },
                ],
              }))
            }
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
                    onNameChange={(name) =>
                      updateDraft((currentDraft) => ({
                        ...currentDraft,
                        players: currentDraft.players.map((currentPlayer, currentIndex) =>
                          currentIndex === index ? { ...currentPlayer, name } : currentPlayer,
                        ),
                      }))
                    }
                    onToggleColor={() =>
                      updateDraft((currentDraft) => ({
                        ...currentDraft,
                        players: currentDraft.players.map((currentPlayer, currentIndex) =>
                          currentIndex === index
                            ? {
                                ...currentPlayer,
                                fixedColor: cycleColor(currentPlayer.fixedColor),
                              }
                            : currentPlayer,
                        ),
                      }))
                    }
                    onRemove={() =>
                      updateDraft((currentDraft) => ({
                        ...currentDraft,
                        players: currentDraft.players.filter(
                          (_, currentIndex) => currentIndex !== index,
                        ),
                      }))
                    }
                  />
                )
              })}
            </div>
          </SortableContext>
        </DndContext>
      </section>

      {saveError === null ? null : (
        <div className="rounded-2xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {saveError}
        </div>
      )}
    </div>
  )
}
