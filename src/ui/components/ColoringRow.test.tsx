import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  createConditionalTxFixture,
  createGameFixture,
  createPlayers,
} from '../../test/fixtures'
import { ColoringRow } from './ColoringRow'

describe('ColoringRow', () => {
  it('shows fitness, condition text, and three-character player labels', () => {
    const players = createPlayers(['Mara', 'Milo', 'Eve'])
    const game = createGameFixture({ players })
    const txs = [
      createConditionalTxFixture({
        gameId: game.id,
        condition: { playerId: players[0].id, color: 'blue' },
        equations: [{ i: players[1].id, j: players[2].id, weight: -1 }],
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
    expect(screen.getByText('if Mara is blue')).toBeInTheDocument()
    expect(screen.getByText('Mar')).toBeInTheDocument()
    expect(screen.getByText('Mil')).toBeInTheDocument()
  })
})
