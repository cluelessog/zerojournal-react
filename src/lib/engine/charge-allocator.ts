import type { RawTrade } from '@/lib/types'

export interface AllocatedCharges {
  total: number
  ratio: number            // filteredTurnover / totalTurnover (0-1)
  filteredTurnover: number
  totalTurnover: number
}

function sumTurnover(trades: RawTrade[]): number {
  return trades.reduce((sum, t) => sum + t.price * t.quantity, 0)
}

export function allocateCharges(
  totalCharges: number,
  allTrades: RawTrade[],
  filteredTrades: RawTrade[],
): AllocatedCharges {
  const totalTurnover = sumTurnover(allTrades)
  const filteredTurnover = sumTurnover(filteredTrades)

  if (totalTurnover === 0) {
    return { total: 0, ratio: 0, filteredTurnover: 0, totalTurnover: 0 }
  }

  const ratio = filteredTurnover / totalTurnover
  return {
    total: totalCharges * ratio,
    ratio,
    filteredTurnover,
    totalTurnover,
  }
}
