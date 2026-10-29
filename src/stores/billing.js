// The student's plan (billing_accounts, RLS: only their own row) and what is left of each AI limit
// (rpc my_ai_allowance, limits per plan in the plan_limits table). Pages call `loadAllowances()`
// on mount and `refreshAllowances()` after every AI use, so all counters stay in sync.

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'

const EMPTY = { plan: 'free', max: 0, period: 'day', used: 0, left: 0 }

/** Row from billing_accounts → what the UI needs (same rules as the old getMyBilling()). */
export function toMyBilling(data, now = Date.now()) {
  const pass = data?.pass_until && new Date(data.pass_until).getTime() > now ? data.pass_until : null
  const sub = data?.subscription_until && new Date(data.subscription_until).getTime() > now ? data.subscription_until : null
  // The pass usually lasts longer; if both are active, show the later one.
  const kind = pass && (!sub || pass >= sub) ? 'pass' : sub ? 'subscription' : null
  return {
    premium: kind !== null,
    kind,
    until: kind === 'pass' ? pass : kind === 'subscription' ? sub : null,
    cancelAtPeriodEnd: kind === 'subscription' && Boolean(data?.cancel_at_period_end),
    paymentProblem: data?.subscription_status === 'past_due',
    hasCustomer: Boolean(data?.stripe_customer_id),
    /** Raw subscription status (account deletion refuses while a subscription still renews). */
    subscriptionStatus: data?.subscription_status ?? null,
    rawCancelAtPeriodEnd: Boolean(data?.cancel_at_period_end),
  }
}

export const useBillingStore = defineStore('billing', () => {
  const billing = ref(null)
  const allowances = ref(null) // { [feature]: { plan, max, period, used, left } }
  let allowancePromise = null

  async function loadBilling(force = false) {
    if (billing.value && !force) return billing.value
    const { data, error } = await supabase
      .from('billing_accounts')
      .select('stripe_customer_id, subscription_status, subscription_until, cancel_at_period_end, pass_until')
      .maybeSingle()
    if (error) throw error
    billing.value = toMyBilling(data)
    return billing.value
  }

  async function loadAllowances(force = false) {
    if (allowances.value && !force) return allowances.value
    if (allowancePromise && !force) return allowancePromise
    allowancePromise = (async () => {
      const { data, error } = await supabase.rpc('my_ai_allowance')
      allowancePromise = null
      if (error) throw error
      allowances.value = Object.fromEntries((data ?? []).map(r => [r.feature, {
        plan: r.plan, max: r.max_uses, period: r.period, used: r.used, left: Math.max(0, r.max_uses - r.used),
      }]))
      return allowances.value
    })()
    return allowancePromise
  }

  /** Call after an AI feature was used (or failed with a 429): fetches fresh counters. */
  const refreshAllowances = () => loadAllowances(true).catch(() => allowances.value)

  /** What is left of one feature ('essay_feedback' | 'tutor' | 'open_grading' | 'notes' | 'flashcards'). */
  const allowanceFor = feature => allowances.value?.[feature] ?? null

  function reset() { billing.value = null; allowances.value = null }

  return { billing, allowances, loadBilling, loadAllowances, refreshAllowances, allowanceFor, reset, EMPTY }
})
