import { describe, it, expect } from 'vitest'
import { parseLocalDate, dateDiffDays } from '@/lib/engine/date-utils'

describe('parseLocalDate', () => {
  it('returns the correct date regardless of timezone', () => {
    const date = parseLocalDate('2025-04-01')
    expect(date.getFullYear()).toBe(2025)
    expect(date.getMonth()).toBe(3) // April = 3 (0-indexed)
    expect(date.getDate()).toBe(1)
  })

  it('handles month boundaries correctly', () => {
    const date = parseLocalDate('2025-03-31')
    expect(date.getMonth()).toBe(2) // March = 2
    expect(date.getDate()).toBe(31)
  })

  it('handles year boundaries correctly', () => {
    const date = parseLocalDate('2025-01-01')
    expect(date.getFullYear()).toBe(2025)
    expect(date.getMonth()).toBe(0) // January = 0
    expect(date.getDate()).toBe(1)
  })

  it('handles December 31 correctly', () => {
    const date = parseLocalDate('2024-12-31')
    expect(date.getFullYear()).toBe(2024)
    expect(date.getMonth()).toBe(11) // December = 11
    expect(date.getDate()).toBe(31)
  })
})

describe('dateDiffDays', () => {
  it('returns 0 for same date', () => {
    expect(dateDiffDays('2025-04-01', '2025-04-01')).toBe(0)
  })

  it('returns 1 for consecutive dates', () => {
    expect(dateDiffDays('2025-04-01', '2025-04-02')).toBe(1)
  })

  it('returns 2 for two-day gap', () => {
    expect(dateDiffDays('2025-04-01', '2025-04-03')).toBe(2)
  })

  it('handles month boundary correctly', () => {
    expect(dateDiffDays('2025-03-31', '2025-04-01')).toBe(1)
  })

  it('handles year boundary correctly', () => {
    expect(dateDiffDays('2024-12-31', '2025-01-01')).toBe(1)
  })

  it('returns negative for reversed dates', () => {
    expect(dateDiffDays('2025-04-03', '2025-04-01')).toBe(-2)
  })

  it('handles multi-day span across months', () => {
    // Feb 28 to Mar 3 (non-leap year 2025) = 3 days
    expect(dateDiffDays('2025-02-28', '2025-03-03')).toBe(3)
  })
})
