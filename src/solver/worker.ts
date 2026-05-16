/// <reference lib="webworker" />

import { solveGame } from './solve'
import type { SolveRequest, SolveResponse } from './types'

const workerScope = self as DedicatedWorkerGlobalScope

workerScope.addEventListener('message', (event: MessageEvent<SolveRequest>) => {
  if (event.data.kind !== 'solve') {
    return
  }

  const startedAt = performance.now()
  const results = solveGame(event.data.game, event.data.txs)
  const response: SolveResponse = {
    kind: 'solved',
    results,
    elapsedMs: performance.now() - startedAt,
  }

  workerScope.postMessage(response)
})

export {}
