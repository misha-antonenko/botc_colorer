import type { Player } from '../../solver/types'

interface PlayerPickerProps {
  label: string
  players: Player[]
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function PlayerPicker({
  label,
  players,
  value,
  onChange,
  disabled = false,
}: PlayerPickerProps) {
  return (
    <label className="flex flex-col gap-2 text-sm text-mist-300">
      <span>{label}</span>
      <select
        aria-label={label}
        className="rounded-xl border border-mist-700 bg-mist-900 px-3 py-2 text-base text-mist-100"
        value={value}
        disabled={disabled || players.length === 0}
        onChange={(event) => onChange(event.target.value)}
      >
        {players.length === 0 ? (
          <option value="">No players</option>
        ) : (
          players.map((player, index) => (
            <option key={player.id} value={player.id}>
              {(player.name.trim() || `Seat ${index + 1}`) + ` (#${index + 1})`}
            </option>
          ))
        )}
      </select>
    </label>
  )
}
