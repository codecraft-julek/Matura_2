// 👍/👎 on AI answers (table ai_ratings). RLS checks the answer belongs to the student.

import { z } from 'zod'
import { RATING_KINDS } from '@/lib/ratings/types'
import { supabase } from '@/lib/supabase'

const ratingSchema = z.object({
  kind: z.enum(RATING_KINDS),
  targetId: z.string().min(1).max(64),
  rating: z.union([z.literal(1), z.literal(-1)]),
  comment: z.string().trim().max(500).default(''),
})

/** Saves (or changes) one rating. 👍 clears an earlier comment. → { ok } */
export async function rateAi(input) {
  const parsed = ratingSchema.safeParse({ ...input, targetId: String(input.targetId) })
  if (!parsed.success) return { ok: false }
  const { kind, targetId, rating, comment } = parsed.data
  const { error } = await supabase.from('ai_ratings').upsert(
    { target_kind: kind, target_id: targetId, rating, comment: rating === 1 ? '' : comment, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,target_kind,target_id' },
  )
  return { ok: !error }
}

/** The student's own ratings → { [targetId]: { rating, comment } } */
export async function myRatings(kind, ids) {
  if (!ids.length) return {}
  const { data } = await supabase.from('ai_ratings').select('target_id, rating, comment').eq('target_kind', kind).in('target_id', ids.map(String))
  return Object.fromEntries((data ?? []).map(r => [r.target_id, { rating: r.rating, comment: r.comment }]))
}

export async function myRating(kind, id) {
  return (await myRatings(kind, [id]))[String(id)] ?? null
}
