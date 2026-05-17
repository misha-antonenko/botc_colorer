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
  return `rgba(148, 163, 184, ${intensity})`
}

export function FMatrix({ game, txs }: FMatrixProps) {
  const stateMatrix = useMemo(() => buildStateMatrixData(game, txs), [game, txs])

  return (
    <div className="max-h-[70svh] overflow-auto rounded-2xl border border-zinc-800 bg-zinc-950/80 shadow-lg shadow-zinc-950/40">
      <table className="f-matrix min-w-full text-left text-sm">
        <thead>
          <tr>
            <th className="corner border-b border-r border-zinc-800 bg-zinc-950 px-2 py-2 text-[10px] uppercase tracking-wide text-zinc-400">
              Active \ Passive
            </th>
            {game.players.map((player, index) => (
              <th
                key={player.id}
                className="border-b border-zinc-800 bg-zinc-950 px-2 py-2 align-bottom"
              >
                <div className="text-xs font-semibold text-zinc-100">
                  {getPlayerName(game, player.id)}
                </div>
                <div className="text-[10px] text-zinc-400">Seat {index + 1}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {game.players.map((rowPlayer, rowIndex) => (
            <tr key={rowPlayer.id}>
              <th className="border-r border-zinc-800 bg-zinc-950 px-2 py-2">
                <div className="text-xs font-semibold text-zinc-100">
                  {getPlayerName(game, rowPlayer.id)}
                </div>
                <div className="text-[10px] text-zinc-400">Seat {rowIndex + 1}</div>
              </th>
              {game.players.map((columnPlayer, columnIndex) => {
                const isDiagonal = rowIndex === columnIndex
                const directedWeight = stateMatrix.directedWeights[rowIndex][columnIndex]
                const range = stateMatrix.conditionalRanges[rowIndex][columnIndex]

                return (
                  <td
                    key={columnPlayer.id}
                    className="border-b border-r border-zinc-800 px-2 py-2 align-top font-mono text-[11px] leading-tight text-zinc-100"
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
