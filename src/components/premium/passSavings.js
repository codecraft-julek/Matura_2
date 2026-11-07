// How much the Pakiet saves against paying monthly until it ends. Counted from today, because the
// saving shrinks every month: once monthly is no longer dearer, this returns null and the page
// stops claiming a saving.
import { PASS_UNTIL, PLANS } from '@/config/plans'

const grosze = price => Math.round(parseFloat(price.replace(',', '.')) * 100)
const planOf = id => PLANS.find(p => p.id === id)

/** The same day k months later, or the month's last day when it is shorter. */
function monthsLater(from, k) {
  const lastDay = new Date(from.getFullYear(), from.getMonth() + k + 1, 0).getDate()
  return new Date(from.getFullYear(), from.getMonth() + k, Math.min(from.getDate(), lastDay))
}

export function passSavings(now = new Date()) {
  const until = new Date(PASS_UNTIL)
  let payments = 0
  while (monthsLater(now, payments) <= until) payments++

  const monthly = grosze(planOf('monthly').price) * payments
  const saved = monthly - grosze(planOf('matura').price)
  if (saved <= 0) return null
  return { payments, percent: Math.floor((saved / monthly) * 100) }
}
