import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { beforeEach, afterEach, vi } from 'vitest'
import { db } from '../db/schema'

async function clearDatabase(): Promise<void> {
  await db.transaction('rw', db.games, db.transactions, async () => {
    await db.transactions.clear()
    await db.games.clear()
  })
}

beforeEach(async () => {
  localStorage.clear()
  await clearDatabase()
  vi.stubGlobal('alert', vi.fn())
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  )
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(async () => {
  localStorage.clear()
  await clearDatabase()
  vi.unstubAllGlobals()
})
