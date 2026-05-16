import { create } from 'zustand'
import type { GameId, SolutionsCap, WorkspaceTab } from '../solver/types'

interface UiState {
  activeTabs: Record<GameId, WorkspaceTab>
  solutionCaps: Record<GameId, SolutionsCap>
  setActiveTab: (gameId: GameId, tab: WorkspaceTab) => void
  setSolutionCap: (gameId: GameId, cap: SolutionsCap) => void
}

export const DEFAULT_SOLUTION_CAP: SolutionsCap = 10

export const useUiStore = create<UiState>((set) => ({
  activeTabs: {},
  solutionCaps: {},
  setActiveTab: (gameId, tab) =>
    set((state) => ({
      activeTabs: {
        ...state.activeTabs,
        [gameId]: tab,
      },
    })),
  setSolutionCap: (gameId, cap) =>
    set((state) => ({
      solutionCaps: {
        ...state.solutionCaps,
        [gameId]: cap,
      },
    })),
}))
