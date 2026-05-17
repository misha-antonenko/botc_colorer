import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createDyadicTxFixture, createGameFixture, createPlayers } from '../../test/fixtures'
import { FMatrix } from './FMatrix'

describe('FMatrix', () => {
  it('uses zinc-based background tints for diagonal and weighted cells', () => {
    const players = createPlayers(['Alice', 'Bob'])
    const game = createGameFixture({ players })
    const txs = [
      createDyadicTxFixture({
        gameId: game.id,
        active: players[0].id,
        passive: players[1].id,
        weight: 1,
      }),
    ]

    const { container } = render(<FMatrix game={game} txs={txs} />)
    const cells = Array.from(container.querySelectorAll('tbody td'))

    expect(cells).toHaveLength(4)
    expect(cells[0]).toHaveStyle({ backgroundColor: 'rgba(9, 9, 11, 0.95)' })
    expect(cells[1]).toHaveStyle({ backgroundColor: 'rgba(161, 161, 170, 0.46)' })
  })
})
