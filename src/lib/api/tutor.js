// Tutor chats of the logged-in student (RLS: only their own rows). Replies come from the
// `tutor-chat` Edge Function (streamTutorReply in @/lib/ai); here are only reads and the delete.

import { z } from 'zod'
import { myRatings } from '@/lib/api/ratings'
import { supabase } from '@/lib/supabase'

const CHAT_COLUMNS = 'id, title, exam_id, group_no, updated_at'
const isUuid = id => z.uuid().safeParse(id).success

/** Latest 50 chats, newest first. */
export async function listMyChats() {
  const { data, error } = await supabase.from('tutor_chats').select(CHAT_COLUMNS).order('updated_at', { ascending: false }).limit(50)
  if (error) throw error
  return data ?? []
}

/** Messages of one chat, oldest first, each assistant reply with the student's 👍/👎 (or null). */
async function messagesWithRatings(chatId) {
  const { data, error } = await supabase.from('tutor_messages').select('id, role, content').eq('chat_id', chatId).order('id')
  if (error) throw error
  const rows = data ?? []
  const replyIds = rows.filter(m => m.role === 'assistant').map(m => m.id)
  const ratings = await myRatings('tutor_message', replyIds).catch(() => ({}))
  return rows.map(m => ({ ...m, rating: m.role === 'assistant' ? ratings[String(m.id)] ?? null : null }))
}

/** One chat with its messages → { chat, messages }, or null when it doesn't exist (or isn't yours). */
export async function getChat(id) {
  if (!isUuid(id)) return null
  const handed = takeHandoff(id)
  if (handed) return handed
  const { data: chat, error } = await supabase.from('tutor_chats').select(CHAT_COLUMNS).eq('id', id).maybeSingle()
  if (error) throw error
  if (!chat) return null
  return { chat, messages: await messagesWithRatings(id) }
}

/**
 * The student's latest chat about one exam task (AskTutor continues it) → { chatId, messages }.
 * chatId is null when there is none yet.
 */
export async function latestTaskChat(examId, groupNo) {
  const { data: chat, error } = await supabase
    .from('tutor_chats')
    .select('id')
    .eq('exam_id', examId)
    .eq('group_no', groupNo)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!chat) return { chatId: null, messages: [] }
  return { chatId: chat.id, messages: await messagesWithRatings(chat.id) }
}

/** Deletes one chat (its messages go with it). → { ok, error } */
export async function deleteChat(chatId) {
  if (!isUuid(chatId)) return { ok: false, error: 'Nie ma takiej rozmowy.' }
  const { error } = await supabase.from('tutor_chats').delete().eq('id', chatId)
  if (error) return { ok: false, error: 'Nie udało się usunąć rozmowy. Spróbuj ponownie.' }
  return { ok: true }
}

// A new chat started on /tutor moves to /tutor/<id> once the first reply is saved. The chat page
// takes what is already on screen from here instead of showing a skeleton and loading it again.
let handoff = null
export function handOffChat(value) { handoff = value }
function takeHandoff(id) {
  if (handoff?.chat.id !== id) return null
  const value = { ...handoff, fresh: true }
  handoff = null
  return value
}
