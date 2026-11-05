// Creators' codes. The tables stay closed: the website reads through database functions and writes
// through the Edge Function `affiliate-admin` (admins only).

import { callEdge } from '@/lib/edge'
import { supabase } from '@/lib/supabase'

/** Thrown to /admin pages when the logged-in account isn't in app_admins. */
export class NoAdminAccess extends Error {}

async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args)
  if (error?.code === '42501') throw new NoAdminAccess()
  if (error) throw error
  return data
}

/** At checkout: → { code, discountPercent } or null when the code doesn't work. */
export const checkAffiliateCode = code => rpc('check_affiliate_code', { p_code: code })

/** On /creators: the logged-in creator's numbers (amounts in grosze), null for anyone else. */
export const loadAffiliatePanel = () => rpc('my_affiliate_panel')

// ---------- /admin ----------

/** Every creator with totals. Throws NoAdminAccess. */
export const adminAffiliates = () => rpc('admin_affiliates')

/** One creator with their numbers and private details, or null. Throws NoAdminAccess. */
export const adminAffiliate = id => rpc('admin_affiliate', { p_affiliate: id })

/** → { ok, id, inviteSent } or { ok: false, error, fieldErrors? } */
export const saveAffiliate = (id, affiliate) => callEdge('affiliate-admin', { action: 'save', id, affiliate })
export const sendCreatorInvite = id => callEdge('affiliate-admin', { action: 'invite', id })
export const addPayout = payout => callEdge('affiliate-admin', { action: 'payout', payout })
export const deletePayout = id => callEdge('affiliate-admin', { action: 'deletePayout', id })
