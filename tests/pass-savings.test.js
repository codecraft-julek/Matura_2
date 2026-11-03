import { describe, expect, it } from 'vitest'
import { passSavings } from '../src/components/premium/passSavings'
import { PASS_UNTIL } from '../src/config/plans'
import { MATURA_PASS_UNTIL } from '../supabase/functions/_shared/billing'

describe('what the Pakiet saves', () => {
  it('compares it with paying monthly until the Pakiet ends', () => {
    // 24,99 zł + 6 × 29,99 zł = 204,93 zł against 129 zł
    expect(passSavings(new Date(2026, 10, 3))).toEqual({ payments: 7, percent: 37 })
  })
  it('counts one payment fewer each month', () => {
    expect(passSavings(new Date(2026, 11, 3))).toEqual({ payments: 6, percent: 26 })
    expect(passSavings(new Date(2027, 0, 3))).toEqual({ payments: 5, percent: 11 })
  })
  it('claims no saving once monthly is not dearer', () => {
    expect(passSavings(new Date(2027, 1, 3))).toBeNull()
    expect(passSavings(new Date(2027, 4, 3))).toBeNull()
  })
  it('handles a purchase on the last day of a long month', () => {
    expect(passSavings(new Date(2026, 9, 31)).payments).toBe(8)
  })
  it('uses the same end date as the server', () => {
    expect(PASS_UNTIL).toBe(MATURA_PASS_UNTIL)
  })
})
