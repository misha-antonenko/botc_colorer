import { describe, expect, it, vi } from 'vitest'
import {
  buildPortablePayload,
  importPortablePayload,
  shareOrDownloadPortablePayload,
} from './portable'
import { db, encodeGameRow, encodeTransactionRow } from './schema'
import {
  createConditionalTxFixture,
  createDyadicTxFixture,
  createGameFixture,
  createPlayers,
} from '../test/fixtures'

describe('portable payloads', () => {
  it('round-trips export and import losslessly without collisions', async () => {
    const players = createPlayers(['Alice', 'Bob', 'Carol'])
    const game = createGameFixture({ players, blueCountMin: 1, blueCountMax: 2 })
    const transactions = [
      createDyadicTxFixture({
        id: 'tx-1',
        gameId: game.id,
        active: players[0].id,
        passive: players[1].id,
        weight: 1,
      }),
      createConditionalTxFixture({
        id: 'tx-2',
        gameId: game.id,
        condition: { playerId: players[2].id, color: 'blue' },
        equations: [{ i: players[0].id, j: players[1].id, weight: -0.5 }],
      }),
    ]

    await db.games.put(encodeGameRow(game))
    await db.transactions.bulkPut(transactions.map(encodeTransactionRow))

    const exported = await buildPortablePayload(undefined, 123)

    await db.transaction('rw', db.games, db.transactions, async () => {
      await db.transactions.clear()
      await db.games.clear()
    })

    await importPortablePayload(exported)

    const roundTrip = await buildPortablePayload(undefined, 123)

    expect(roundTrip).toEqual(exported)
  })

  it('falls back to a download link when file sharing is unavailable', async () => {
    vi.useFakeTimers()

    const createObjectUrl = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:fixture-export')
    const revokeObjectUrl = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined)
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined)

    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: undefined,
    })
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: undefined,
    })

    await shareOrDownloadPortablePayload(
      {
        version: 1,
        exportedAt: 123,
        games: [],
        transactions: [],
      },
      'Fixture export',
    )

    expect(createObjectUrl).toHaveBeenCalledOnce()
    expect(clickSpy).toHaveBeenCalledOnce()
    expect(
      document.body.querySelector('a[download="fixture-export.json"]'),
    ).not.toBeNull()

    vi.advanceTimersByTime(1000)

    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:fixture-export')
    expect(document.body.querySelector('a[download="fixture-export.json"]')).toBeNull()

    vi.useRealTimers()
  })
})
