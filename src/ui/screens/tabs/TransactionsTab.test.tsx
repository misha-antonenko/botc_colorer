import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { createDyadicTxFixture, createGameFixture, createPlayers } from '../../../test/fixtures'
import { TransactionsTab } from './TransactionsTab'

describe('TransactionsTab', () => {
  it('renders transaction notes beneath the summary text', () => {
    const players = createPlayers(['Alice', 'Bob', 'Carol'])
    const game = createGameFixture({ players })
    const tx = createDyadicTxFixture({
      gameId: game.id,
      active: players[0].id,
      passive: players[1].id,
      weight: 2,
      note: 'Clockmaker info',
    })

    render(
      <MemoryRouter>
        <TransactionsTab game={game} txs={[tx]} />
      </MemoryRouter>,
    )

    expect(screen.getByText('Clockmaker info')).toBeInTheDocument()
    expect(screen.getByText('Alice → Bob, w = +2')).toBeInTheDocument()
  })
})
