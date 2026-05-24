import { useMemo, useRef, type ChangeEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  createGame,
  duplicateGame,
  useAllTransactions,
  useGames,
} from '../../db/queries'
import {
  createPortablePayload,
  importPortablePayload,
  shareOrDownloadPortablePayload,
} from '../../db/portable'
import { solveGame } from '../../solver/solve'
import type { Game, Transaction } from '../../solver/types'
import { formatSignedNumber } from '../formatters'
import { formatTimestamp } from '../formatters'

const EMPTY_GAMES: Game[] = []
const EMPTY_TRANSACTIONS: Transaction[] = []

export function GamesList() {
  const games = useGames() ?? EMPTY_GAMES
  const transactions = useAllTransactions() ?? EMPTY_TRANSACTIONS
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const transactionsByGameId = useMemo(() => {
    const groupedTransactions = new Map<string, typeof transactions>()

    for (const transaction of transactions) {
      const gameTransactions = groupedTransactions.get(transaction.gameId) ?? []
      gameTransactions.push(transaction)
      groupedTransactions.set(transaction.gameId, gameTransactions)
    }

    return groupedTransactions
  }, [transactions])
  const previewByGameId = useMemo(() => {
    const previews = new Map<string, number | null>()

    for (const game of games) {
      try {
        const results = solveGame(game, transactionsByGameId.get(game.id) ?? [])
        previews.set(game.id, results[0]?.fitness ?? null)
      } catch {
        previews.set(game.id, null)
      }
    }

    return previews
  }, [games, transactionsByGameId])
  async function handleCreateGame(): Promise<void> {
    const game = await createGame()
    navigate(`/g/${game.id}`)
  }

  async function handleDuplicateGame(gameId: string): Promise<void> {
    const game = await duplicateGame(gameId)
    navigate(`/g/${game.id}`)
  }

  async function handleExportAll(): Promise<void> {
    try {
      const payload = createPortablePayload(games, transactions)
      await shareOrDownloadPortablePayload(payload, 'botc-colorer-export')
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Failed to export games.')
    }
  }

  async function handleExportGame(gameId: string, name: string): Promise<void> {
    try {
      const payload = createPortablePayload(
        games.filter((game) => game.id === gameId),
        transactions.filter((transaction) => transaction.gameId === gameId),
      )
      await shareOrDownloadPortablePayload(payload, name)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Failed to export the game.')
    }
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0]

    if (file === undefined) {
      return
    }

    try {
      const importedPayload = JSON.parse(await file.text()) as unknown
      const result = await importPortablePayload(importedPayload)

      if (result.games[0] !== undefined) {
        navigate(`/g/${result.games[0].id}`)
      }
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Failed to import JSON payload.')
    } finally {
      event.target.value = ''
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6">
      <header className="mb-6 rounded-3xl border border-mist-800 bg-mist-950/80 p-5 shadow-2xl shadow-mist-950/40">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-sm uppercase tracking-[0.25em] text-mist-400">
              BotC colorer
            </div>
            <h1 className="mt-2 text-3xl font-bold text-white">Games</h1>
            <p className="mt-2 max-w-2xl text-sm text-mist-400">
              Find plausible colorings by logging player interactions.
            </p>
            <p className="mt-2 max-w-2xl text-sm text-mist-400">
              All data is stored in your web browser. If you don't export it, it will be deleted soon.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded-full bg-mist-200 px-4 py-2 text-sm font-semibold text-mist-950"
              onClick={() => void handleCreateGame()}
            >
              New game
            </button>
            <button
              type="button"
              className="rounded-full border border-mist-700 px-4 py-2 text-sm text-mist-200"
              onClick={() => fileInputRef.current?.click()}
            >
              Import
            </button>
            <button
              type="button"
              className="rounded-full border border-mist-700 px-4 py-2 text-sm text-mist-200"
              onClick={() => void handleExportAll()}
            >
              Export all
            </button>
          </div>
        </div>
        <input
          ref={fileInputRef}
          hidden
          type="file"
          accept="application/json"
          onChange={(event) => void handleImport(event)}
        />
      </header>

      {games.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-mist-700 bg-mist-950/60 p-8 text-center text-mist-300">
          <div className="text-lg font-semibold text-mist-100">No games yet</div>
          <p className="mt-2 text-sm text-mist-400">
            Start by creating a game, then use the workspace tabs to build observations and review
            candidate colorings.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {games.map((game) => {
            const previewFitness = previewByGameId.get(game.id) ?? null

            return (
              <article
                key={game.id}
                className="rounded-3xl border border-mist-800 bg-mist-950/80 p-5 shadow-2xl shadow-mist-950/30"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-semibold text-white">{game.name}</h2>
                      <span className="rounded-full border border-mist-700 px-2 py-1 text-xs text-mist-300">
                        {game.players.length} players
                      </span>
                    </div>
                    <div className="text-sm text-mist-400">
                      Last updated {formatTimestamp(game.updatedAt)}
                    </div>
                    <div className="text-sm text-mist-300">
                      Top fitness:{' '}
                      <span className="font-mono text-mist-100">
                        {previewFitness === null ? '—' : formatSignedNumber(previewFitness)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      className="inline-flex items-center justify-center rounded-full bg-mist-200 px-4 py-2 text-sm font-semibold leading-none text-mist-950"
                      to={`/g/${game.id}`}
                    >
                      Open
                    </Link>
                    <button
                      type="button"
                      className="rounded-full border border-mist-700 px-4 py-2 text-sm text-mist-200"
                      onClick={() => void handleDuplicateGame(game.id)}
                    >
                      Duplicate
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-mist-700 px-4 py-2 text-sm text-mist-200"
                      onClick={() => void handleExportGame(game.id, game.name)}
                    >
                      Export
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
