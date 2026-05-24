interface ToggleRowProps {
  label: string
  description?: string
  checked: boolean
  onChange: (nextValue: boolean) => void
  disabled?: boolean
}

export function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: ToggleRowProps) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-mist-800 bg-mist-900/70 px-3 py-2">
      <span className="flex flex-col text-left">
        <span className="text-sm font-medium text-mist-100">{label}</span>
        {description === undefined ? null : (
          <span className="text-xs text-mist-400">{description}</span>
        )}
      </span>
      <input
        aria-label={label}
        type="checkbox"
        className="h-5 w-5 accent-mist-300"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  )
}
