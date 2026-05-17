import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { createGameFixture, createPlayers } from '../../../test/fixtures'
import { SetupTab } from './SetupTab'

describe('SetupTab', () => {
  afterEach(() => {
    cleanup()
  })

  it('uses numeric input mode and allows temporary out-of-range typing for blue counts', async () => {
    const user = userEvent.setup()
    const game = createGameFixture({
      players: createPlayers(['Alice', 'Bob', 'Carol', 'Dan', 'Eve']),
      blueCountMin: 0,
      blueCountMax: 3,
    })

    render(<SetupTab game={game} txs={[]} />)

    const minimumInput = screen.getByLabelText('Blue count minimum')

    expect(minimumInput).toHaveAttribute('inputmode', 'numeric')

    await user.clear(minimumInput)
    await user.type(minimumInput, '12')

    expect(minimumInput).toHaveValue('12')
  })

  it('shifts the blue range when a player is added', async () => {
    const user = userEvent.setup()
    const game = createGameFixture({
      players: createPlayers(['Alice', 'Bob', 'Carol', 'Dan', 'Eve', 'Frank']),
      blueCountMin: 3,
      blueCountMax: 5,
    })

    render(<SetupTab game={game} txs={[]} />)

    const addPlayerButtons = screen.getAllByRole('button', { name: 'Add player' })
    await user.click(addPlayerButtons[addPlayerButtons.length - 1]!)

    expect(screen.getByLabelText('Blue count minimum')).toHaveValue('4')
    expect(screen.getByLabelText('Blue count maximum')).toHaveValue('6')
    expect(screen.queryByText(/Allowed blue totals/i)).not.toBeInTheDocument()
  })
})
