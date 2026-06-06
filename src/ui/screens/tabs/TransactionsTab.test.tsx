import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { createGameFixture, createLogicalTxFixture, createPlayers } from '../../../test/fixtures'
import { TransactionsTab } from './TransactionsTab'

afterEach(() => {
  cleanup()
})

describe('TransactionsTab', () => {
  it('renders transaction notes beneath the formula text', () => {
    const players = createPlayers(['Alice', 'Bob', 'Carol'])
    const game = createGameFixture({ players })
    const tx = createLogicalTxFixture({
      gameId: game.id,
      formula: 'Al = Bob',
      weight: 1,
      note: 'Clockmaker info',
    })

    render(
      <MemoryRouter>
        <TransactionsTab game={game} txs={[tx]} />
      </MemoryRouter>,
    )

    expect(screen.getByText('Clockmaker info')).toBeInTheDocument()
    expect(screen.getByText('Al = Bob')).toBeInTheDocument()
  })

  it('shows weight only when it is not 1', () => {
    const players = createPlayers(['Alice', 'Bob'])
    const game = createGameFixture({ players })
    const txWeight1 = createLogicalTxFixture({
      gameId: game.id,
      formula: 'Al',
      weight: 1,
    })
    const txWeight2 = createLogicalTxFixture({
      gameId: game.id,
      formula: 'Bob',
      weight: 2,
    })

    render(
      <MemoryRouter>
        <TransactionsTab game={game} txs={[txWeight1, txWeight2]} />
      </MemoryRouter>,
    )

    expect(screen.getByText('Al')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText(', w = +2')).toBeInTheDocument()
    expect(screen.queryByText(', w = +1')).not.toBeInTheDocument()
  })

  it('allows formula to be edited by clicking', async () => {
    const players = createPlayers(['Alice', 'Bob'])
    const game = createGameFixture({ players })
    const tx = createLogicalTxFixture({
      gameId: game.id,
      formula: 'Alice',
      weight: 1,
    })

    render(
      <MemoryRouter>
        <TransactionsTab game={game} txs={[tx]} />
      </MemoryRouter>,
    )

    await userEvent.click(screen.getByText('Alice'))

    const input = screen.getByLabelText('Edit formula')
    expect(input).toBeInTheDocument()
    expect(input).toHaveValue('Alice')
  })

  it('shows validation error for invalid formula', async () => {
    const players = createPlayers(['Alice', 'Bob'])
    const game = createGameFixture({ players })
    const tx = createLogicalTxFixture({
      gameId: game.id,
      formula: 'Alice',
      weight: 1,
    })

    render(
      <MemoryRouter>
        <TransactionsTab game={game} txs={[tx]} />
      </MemoryRouter>,
    )

    await userEvent.click(screen.getByText('Alice'))
    const input = screen.getByLabelText('Edit formula')
    await userEvent.clear(input)
    await userEvent.type(input, 'Unknown')
    await userEvent.tab()

    expect(screen.getByText(/Unknown player prefix/)).toBeInTheDocument()
  })

  it('preserves invalid formula draft after validation failure', async () => {
    const players = createPlayers(['Charlie', 'Dana'])
    const game = createGameFixture({ players })
    const tx = createLogicalTxFixture({
      gameId: game.id,
      formula: 'Cha',
      weight: 1,
    })

    render(
      <MemoryRouter>
        <TransactionsTab game={game} txs={[tx]} />
      </MemoryRouter>,
    )

    await userEvent.click(screen.getByText('Cha'))
    const input = screen.getByLabelText('Edit formula')
    await userEvent.clear(input)
    await userEvent.type(input, 'Invalid')
    await userEvent.tab()

    expect(screen.getByText(/Unknown player prefix/)).toBeInTheDocument()
    expect(screen.getByText('Invalid')).toBeInTheDocument()

    await userEvent.click(screen.getByText('Invalid'))
    const inputAfterReopen = screen.getByLabelText('Edit formula')
    expect(inputAfterReopen).toHaveValue('Invalid')
  })

  it('clears invalid draft on escape', async () => {
    const players = createPlayers(['Eve', 'Frank'])
    const game = createGameFixture({ players })
    const tx = createLogicalTxFixture({
      gameId: game.id,
      formula: 'Eve',
      weight: 1,
    })

    render(
      <MemoryRouter>
        <TransactionsTab game={game} txs={[tx]} />
      </MemoryRouter>,
    )

    await userEvent.click(screen.getByText('Eve'))
    const input = screen.getByLabelText('Edit formula')
    await userEvent.clear(input)
    await userEvent.type(input, 'Invalid')
    await userEvent.tab()

    expect(screen.getByText('Invalid')).toBeInTheDocument()

    await userEvent.click(screen.getByText('Invalid'))
    screen.getByLabelText('Edit formula')
    await userEvent.keyboard('{Escape}')

    expect(screen.getByText('Eve')).toBeInTheDocument()
    expect(screen.queryByText('Invalid')).not.toBeInTheDocument()
  })
})
