import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { createGameFixture, createLogicalTxFixture, createPlayers } from '../../../test/fixtures'
import { TransactionsTab } from './TransactionsTab'

describe('TransactionsTab', () => {
  it('renders transaction notes beneath the formula text', () => {
    const players = createPlayers(['Alice', 'Bob', 'Carol'])
    const game = createGameFixture({ players })
    const tx = createLogicalTxFixture({
      gameId: game.id,
      formula: 'Al = Bob',
      weight: 2,
      note: 'Clockmaker info',
    })

    render(
      <MemoryRouter>
        <TransactionsTab game={game} txs={[tx]} />
      </MemoryRouter>,
    )

    expect(screen.getByText('Clockmaker info')).toBeInTheDocument()
    expect(screen.getByText('Al = Bob')).toBeInTheDocument()
    expect(screen.getByTitle('Tap to edit weight')).toHaveTextContent('+2')
  })
})
