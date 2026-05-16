import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createGameFixture, createPlayers } from '../../../test/fixtures'
import { useUiStore } from '../../../state/store'
import { SolutionsTab } from './SolutionsTab'

describe('SolutionsTab', () => {
  it('shows tie copy only for rows tied with the previous visible result', () => {
    const game = createGameFixture({
      players: createPlayers(['Alice', 'Bob']),
    })

    useUiStore.setState({
      activeTabs: {},
      solutionCaps: {
        [game.id]: 10,
      },
    })

    render(
      <SolutionsTab
        game={game}
        txs={[]}
        status="solved"
        error={null}
        results={[
          { c: 3, fitness: 1 },
          { c: 1, fitness: 1 },
          { c: 2, fitness: 0 },
          { c: 0, fitness: 0 },
        ]}
      />,
    )

    expect(screen.getAllByText('tied with previous')).toHaveLength(2)
  })
})
