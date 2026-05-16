import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SwipeActionRow } from './SwipeActionRow'

describe('SwipeActionRow', () => {
  it('reveals and executes delete after a left swipe gesture', async () => {
    const user = userEvent.setup()
    const handleDelete = vi.fn()

    render(
      <SwipeActionRow deleteLabel="Delete demo row" onDelete={handleDelete}>
        <div>Demo row</div>
      </SwipeActionRow>,
    )

    const swipeSurface = screen.getByText('Demo row').parentElement

    expect(swipeSurface).not.toBeNull()
    if (swipeSurface === null) {
      throw new Error('Swipe surface not found')
    }

    Object.defineProperty(swipeSurface, 'setPointerCapture', {
      value: vi.fn(),
      configurable: true,
    })
    Object.defineProperty(swipeSurface, 'releasePointerCapture', {
      value: vi.fn(),
      configurable: true,
    })

    fireEvent.pointerDown(swipeSurface, {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 120,
      clientY: 20,
    })
    fireEvent.pointerMove(swipeSurface, {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 40,
      clientY: 20,
    })
    fireEvent.pointerUp(swipeSurface, {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 40,
      clientY: 20,
    })

    await user.click(screen.getByLabelText('Delete demo row'))

    expect(handleDelete).toHaveBeenCalledTimes(1)
  })
})
