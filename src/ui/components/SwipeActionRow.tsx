import { useRef, useState, type ReactNode } from 'react'

interface SwipeActionRowProps {
  children: ReactNode
  deleteLabel: string
  onDelete: () => void
  actionDisabled?: boolean
}

const SWIPE_ACTION_WIDTH = 88
const SWIPE_OPEN_THRESHOLD = SWIPE_ACTION_WIDTH / 3

function isInteractiveTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    target.closest('button, input, label, a, select, textarea, [role="button"]') !== null
  )
}

export function SwipeActionRow({
  children,
  deleteLabel,
  onDelete,
  actionDisabled = false,
}: SwipeActionRowProps) {
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
    if (
      actionDisabled ||
      (event.pointerType === 'mouse' && event.button !== 0) ||
      isInteractiveTarget(event.target)
    ) {
      return
    }

    pointerIdRef.current = event.pointerId
    startXRef.current = event.clientX
    startOffsetRef.current = offsetRef.current
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>): void {
    if (pointerIdRef.current !== event.pointerId || actionDisabled) {
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

    if (!actionDisabled && offsetRef.current <= -SWIPE_OPEN_THRESHOLD) {
      openRow()
      return
    }

    closeRow()
  }

  return (
    <div className="relative w-full overflow-hidden rounded-3xl">
      <div
        className={`absolute inset-y-0 right-0 flex w-[88px] items-center justify-center bg-zinc-800/80 transition-opacity ${
          offset < 0 && !actionDisabled ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <button
          type="button"
          aria-label={deleteLabel}
          className="rounded-full border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={actionDisabled || offset !== -SWIPE_ACTION_WIDTH}
          onClick={() => {
            closeRow()
            onDelete()
          }}
        >
          Delete
        </button>
      </div>
      <div
        className={`relative w-full touch-pan-y ${
          isDragging ? '' : 'transition-transform duration-200 ease-out'
        }`}
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
