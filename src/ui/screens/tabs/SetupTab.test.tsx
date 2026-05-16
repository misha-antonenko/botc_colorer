import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createGameFixture, createPlayers } from '../../../test/fixtures'
import { SetupTab } from './SetupTab'

describe('SetupTab', () => {
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

  it('shows an inclusive blue-count summary', () => {
    const game = createGameFixture({
      players: createPlayers(['Alice', 'Bob', 'Carol', 'Dan', 'Eve']),
      blueCountMin: 1,
      blueCountMax: 3,
    })

    render(<SetupTab game={game} txs={[]} />)

    expect(screen.getAllByText('Allowed blue totals (inclusive): 1-3')).not.toHaveLength(0)
    expect(screen.getAllByLabelText('Allowed blue totals')).not.toHaveLength(0)
  })
})
