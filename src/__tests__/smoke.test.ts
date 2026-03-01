// Smoke test — verifies vitest configuration is working
import { describe, it, expect } from 'vitest'

describe('zeroJournal scaffold', () => {
  it('vitest runs correctly', () => {
    expect(true).toBe(true)
  })

  it('environment is jsdom', () => {
    expect(typeof window).toBe('object')
    expect(typeof document).toBe('object')
  })
})
