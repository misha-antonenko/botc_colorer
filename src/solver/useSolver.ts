import { useEffect, useMemo, useState } from 'react'
import type { Game, SolveRequest, SolveResponse, SolverResult, Transaction } from './types'

interface SolverState {
  results: SolverResult[]
  elapsedMs: number
  status: 'idle' | 'solving' | 'solved' | 'error'
  error: string | null
}

interface SolverSnapshot {
  key: string
  results: SolverResult[]
  elapsedMs: number
  error: string | null
}

const INITIAL_STATE: SolverState = {
  results: [],
  elapsedMs: 0,
  status: 'idle',
  error: null,
}

export function useSolver(game: Game | undefined, txs: Transaction[] | undefined): SolverState {
  const [snapshot, setSnapshot] = useState<SolverSnapshot | null>(null)
  const solveKey = useMemo(() => {
    if (game === undefined || txs === undefined) {
      return null
    }

    return JSON.stringify({
      updatedAt: game.updatedAt,
      players: game.players.map((player) => [player.id, player.fixedColor]),
      blueRange: [game.blueCountMin, game.blueCountMax],
      txs: txs.map((tx) => [tx.id, tx.enabled]),
    })
  }, [game, txs])

  useEffect(() => {
    if (game === undefined || txs === undefined || solveKey === null) {
      return undefined
    }

    const worker = new Worker(new URL('./worker.ts', import.meta.url), {
      type: 'module',
    })

    worker.addEventListener('message', (event: MessageEvent<SolveResponse>) => {
      if (event.data.kind !== 'solved') {
        return
      }

      setSnapshot({
        key: solveKey,
        results: event.data.results,
        elapsedMs: event.data.elapsedMs,
        error: null,
      })
    })

    worker.addEventListener('error', (event) => {
      setSnapshot({
        key: solveKey,
        results: [],
        elapsedMs: 0,
        error: event.message,
      })
    })

    const request: SolveRequest = {
      kind: 'solve',
      game,
      txs,
    }
    worker.postMessage(request)

    return () => {
      worker.terminate()
    }
  }, [game, solveKey, txs])

  if (solveKey === null) {
    return INITIAL_STATE
  }

  if (snapshot === null || snapshot.key !== solveKey) {
    return {
      results: [],
      elapsedMs: 0,
      status: 'solving',
      error: null,
    }
  }

  return {
    results: snapshot.results,
    elapsedMs: snapshot.elapsedMs,
    status: snapshot.error === null ? 'solved' : 'error',
    error: snapshot.error,
  }
}
