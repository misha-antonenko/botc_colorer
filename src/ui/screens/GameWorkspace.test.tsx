import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { GameWorkspace } from './GameWorkspace'

describe('GameWorkspace', () => {
  it('shows a not-found state when the game does not exist', async () => {
    render(
      <MemoryRouter initialEntries={['/g/missing-game']}>
        <Routes>
          <Route path="/g/:gameId" element={<GameWorkspace />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(
      await screen.findByRole('heading', { name: 'Game not found' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to games' })).toHaveAttribute('href', '/')
  })
})
