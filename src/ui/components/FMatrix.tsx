import { useMemo } from 'react'
import type { Game, Transaction } from '../../solver/types'
import { getPlayerName } from '../formatters'
import { buildStateMatrixData, formatMatrixCellValue } from './fMatrixUtils'

interface FMatrixProps {
  game: Game
  txs: Transaction[]
}

function getCellTint(value: number, maxAbsDirected: number): string {
  if (value === 0 || maxAbsDirected === 0) {
    return 'rgba(15, 23, 42, 0.85)'
  }

  const intensity = 0.14 + 0.32 * (Math.abs(value) / maxAbsDirected)
  return value > 0
    ? `rgba(59, 130, 246, ${intensity})`
    : `rgba(239, 68, 68, ${intensity})`
}

export function FMatrix({ game, txs }: FMatrixProps) {
  const stateMatrix = useMemo(() => buildStateMatrixData(game, txs), [game, txs])

  return (
    <div className="max-h-[70svh] overflow-auto rounded-2xl border border-slate-800 bg-slate-950/80 shadow-lg shadow-slate-950/40">
      <table className="f-matrix min-w-full text-left text-sm">
        <thead>
          <tr>
            <th className="corner border-b border-r border-slate-800 bg-slate-950 px-3 py-3 text-xs uppercase tracking-wide text-slate-400">
              Active \ Passive
            </th>
            {game.players.map((player, index) => (
              <th
                key={player.id}
                className="border-b border-slate-800 bg-slate-950 px-3 py-3 align-bottom"
              >
                <div className="text-sm font-semibold text-slate-100">
                  {getPlayerName(game, player.id)}
                </div>
                <div className="text-xs text-slate-400">Seat {index + 1}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {game.players.map((rowPlayer, rowIndex) => (
            <tr key={rowPlayer.id}>
              <th className="border-r border-slate-800 bg-slate-950 px-3 py-3">
                <div className="text-sm font-semibold text-slate-100">
                  {getPlayerName(game, rowPlayer.id)}
                </div>
                <div className="text-xs text-slate-400">Seat {rowIndex + 1}</div>
              </th>
              {game.players.map((columnPlayer, columnIndex) => {
                const isDiagonal = rowIndex === columnIndex
                const directedWeight = stateMatrix.directedWeights[rowIndex][columnIndex]
                const range = stateMatrix.conditionalRanges[rowIndex][columnIndex]

                return (
                  <td
                    key={columnPlayer.id}
                    className="border-b border-r border-slate-800 px-3 py-3 align-top font-mono text-xs text-slate-100"
                    style={{
                      backgroundColor: isDiagonal
                        ? 'rgba(15, 23, 42, 0.95)'
                        : getCellTint(directedWeight, stateMatrix.maxAbsDirected),
                    }}
                  >
                    {isDiagonal ? '−' : formatMatrixCellValue(directedWeight, range)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
