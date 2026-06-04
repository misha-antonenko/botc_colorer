import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createGameFixture,
  createLogicalTxFixture,
  createPlayers,
} from '../../test/fixtures'
import { ColoringRow } from './ColoringRow'

describe('ColoringRow', () => {
  afterEach(() => {
    cleanup()
  })

  it('shows fitness, formula text, and three-character player labels', () => {
    const players = createPlayers(['Mara', 'Milo', 'Eve'])
    const game = createGameFixture({ players })
    const txs = [
      createLogicalTxFixture({
        gameId: game.id,
        formula: 'Mil ^ Eve',
        weight: 1,
      }),
    ]

    render(
      <ColoringRow
        game={game}
        txs={txs}
        result={{ c: 5, fitness: 1 }}
        isTiedWithPrevious={false}
        expanded
        onToggle={vi.fn()}
      />,
    )

    expect(screen.getByText('Fitness = +1')).toBeInTheDocument()
    expect(screen.getByText('Mil ^ Eve')).toBeInTheDocument()
    expect(screen.getByText('Mar')).toBeInTheDocument()
    expect(screen.getByText('Mil')).toBeInTheDocument()
  })

  it('stacks fitness under the color strip on narrow layouts', () => {
    const players = createPlayers(['Mara', 'Milo', 'Eve'])
    const game = createGameFixture({ players })

    render(
      <ColoringRow
        game={game}
        txs={[]}
        result={{ c: 5, fitness: 1 }}
        isTiedWithPrevious={true}
        expanded={false}
        onToggle={vi.fn()}
      />,
    )

    expect(screen.getByText('Fitness = +1')).toBeInTheDocument()
    expect(screen.getByText('Tied with the previous one.')).toBeInTheDocument()
  })
})
