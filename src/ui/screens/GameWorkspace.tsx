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
        <div className="w-full rounded-3xl border border-slate-800 bg-slate-950/80 px-6 py-8 text-center text-slate-300 shadow-2xl shadow-slate-950/30">
          <h1 className="text-2xl font-semibold text-white">Game not found</h1>
          <p className="mt-3 text-sm text-slate-400">
            This game does not exist on this device anymore.
          </p>
          <Link
            className="mt-5 inline-flex rounded-full bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-950"
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
        <div className="rounded-3xl border border-slate-800 bg-slate-950/80 px-6 py-8 text-center text-slate-300">
          Loading game…
        </div>
      </div>
    )
  }

  const enabledTransactionCount = txs.filter((transaction) => transaction.enabled).length
  const topFitness = solver.results[0]?.fitness

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/95 px-4 py-4 backdrop-blur">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <Link className="text-sm text-slate-200 underline decoration-slate-600 underline-offset-4" to="/">
              ← Back to games
            </Link>
            <h1 className="mt-2 text-2xl font-semibold text-white">{game.name}</h1>
          </div>
          <div className="rounded-full border border-slate-700 px-3 py-2 text-xs text-slate-300">
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
                  ? 'bg-slate-200 text-slate-950'
                  : 'border border-slate-700 bg-slate-900/80 text-slate-300'
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

      <div className="safe-bottom sticky bottom-0 z-20 border-t border-slate-800 bg-slate-950/95 px-4 py-3 text-xs text-slate-300 backdrop-blur">
        {game.players.length} players · {enabledTransactionCount} enabled tx · top fitness{' '}
        {topFitness === undefined ? '—' : formatSignedNumber(topFitness)} · last recompute{' '}
        {solver.status === 'solving' ? '…' : `${Math.round(solver.elapsedMs)} ms`}
      </div>

      <Outlet />
    </div>
  )
}
