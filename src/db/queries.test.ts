import { afterEach, describe, expect, it } from 'vitest'
import { createGame } from './queries'
import { db } from './schema'

describe('createGame', () => {
  afterEach(async () => {
    await db.transaction('rw', db.games, db.transactions, async () => {
      await db.transactions.clear()
      await db.games.clear()
    })
    localStorage.clear()
  })

  it('names new games using the existing game count', async () => {
    const firstGame = await createGame()
    const secondGame = await createGame()

    expect(firstGame.name).toBe('Game 1')
    expect(secondGame.name).toBe('Game 2')
  })
})
