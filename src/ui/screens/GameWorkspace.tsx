import { Outlet, Link, useParams } from 'react-router-dom'
import { useGame, useTransactions } from '../../db/queries'
import { useSolver } from '../../solver/useSolver'
import type { WorkspaceTab } from '../../solver/types'
import { DEFAULT_SOLUTION_CAP, useUiStore } from '../../state/store'
import { formatSignedNumber } from '../formatters'
import { SetupTab } from './tabs/SetupTab'
import { SolutionsTab } from './tabs/SolutionsTab'
import { StateTab } from './tabs/StateTab'
import { TransactionsTab } from './tabs/TransactionsTab'

const TABS: Array<{ key: WorkspaceTab; label: string }> = [
  { key: 'setup', label: 'Setup' },
  { key: 'state', label: 'State' },
  { key: 'transactions', label: 'Transactions' },
  { key: 'solutions', label: 'Solutions' },
]

export function GameWorkspace() {
  const { gameId } = useParams()
  const game = useGame(gameId)
  const txs = useTransactions(gameId)
  const solver = useSolver(game, txs)
  const activeTab = useUiStore((state) =>
    gameId === undefined ? 'setup' : (state.activeTabs[gameId] ?? 'setup'),
  )
  const setActiveTab = useUiStore((state) => state.setActiveTab)
  const solutionCap = useUiStore((state) =>
    gameId === undefined ? DEFAULT_SOLUTION_CAP : (state.solutionCaps[gameId] ?? DEFAULT_SOLUTION_CAP),
  )

  if (gameId === undefined || game === null) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center px-4">
        <div className="w-full rounded-3xl border border-zinc-800 bg-zinc-950/80 px-6 py-8 text-center text-zinc-300 shadow-2xl shadow-zinc-950/30">
          <h1 className="text-2xl font-semibold text-white">Game not found</h1>
          <p className="mt-3 text-sm text-zinc-400">
            This game does not exist on this device anymore.
          </p>
          <Link
            className="mt-5 inline-flex rounded-full bg-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-950"
            to="/"
          >
            Back to games
          </Link>
        </div>
      </div>
    )
  }

  if (game === undefined || txs === undefined) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center px-4">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 px-6 py-8 text-center text-zinc-300">
          Loading game…
        </div>
      </div>
    )
  }

  const enabledTransactionCount = txs.filter((transaction) => transaction.enabled).length
  const topFitness = solver.results[0]?.fitness

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col">
      <header className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/95 px-4 py-4 backdrop-blur">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <Link className="text-sm text-zinc-200 underline decoration-zinc-600 underline-offset-4" to="/">
              ← Back to games
            </Link>
            <h1 className="mt-2 text-2xl font-semibold text-white">{game.name}</h1>
          </div>
          <div className="rounded-full border border-zinc-700 px-3 py-2 text-xs text-zinc-300">
            Showing top {solutionCap}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`rounded-2xl px-3 py-2 text-sm font-medium ${
                activeTab === tab.key
                  ? 'bg-zinc-200 text-zinc-950'
                  : 'border border-zinc-700 bg-zinc-900/80 text-zinc-300'
              }`}
              onClick={() => setActiveTab(game.id, tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 px-4 py-4 pb-28">
        {activeTab === 'setup' ? <SetupTab game={game} txs={txs} /> : null}
        {activeTab === 'state' ? <StateTab game={game} txs={txs} /> : null}
        {activeTab === 'transactions' ? <TransactionsTab game={game} txs={txs} /> : null}
        {activeTab === 'solutions' ? (
          <SolutionsTab
            game={game}
            txs={txs}
            status={solver.status}
            error={solver.error}
            results={solver.results}
          />
        ) : null}
      </main>

      <div className="safe-bottom sticky bottom-0 z-20 border-t border-zinc-800 bg-zinc-950/95 px-4 py-3 text-xs text-zinc-300 backdrop-blur">
        {game.players.length} players · {enabledTransactionCount} enabled txs · top fitness:{' '}
        {topFitness === undefined ? '—' : formatSignedNumber(topFitness)} · {' '}
        {solver.status === 'solving' ? 'solving…' : `solved in ${Math.round(solver.elapsedMs)}ms`}
      </div>

      <Outlet />
    </div>
  )
}
