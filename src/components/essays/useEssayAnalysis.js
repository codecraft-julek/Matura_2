// Runs the streamed essay analysis (Edge Function essay-feedback) and opens the feedback page
// when it is done. `state` feeds AnalyzingPanel:
//   phase: 'idle' | 'sending' | 'thinking' (saved, AI started) | 'writing' (text streams in) | 'done'
//   text: all AI text so far (partial JSON), words, startedAt, error

import { computed, onBeforeUnmount, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { essayRoute } from '@/config/routes'
import { streamEssayFeedback } from '@/lib/ai'
import { useBillingStore } from '@/stores/billing'

export function useEssayAnalysis() {
  const router = useRouter()
  const billing = useBillingStore()
  const state = reactive({ phase: 'idle', text: '', words: 0, startedAt: 0, error: '' })
  let alive = true // the student left the page mid-analysis: don't pull them back to the result
  onBeforeUnmount(() => { alive = false })

  /** body = an essayRequestSchema request ({ mode: 'polish', … } or { mode: 'exam', … }). */
  async function run(body, onSuccess) {
    Object.assign(state, { phase: 'sending', text: '', words: 0, startedAt: Date.now(), error: '' })
    let essayId = null
    const res = await streamEssayFeedback(body, {
      onStart: ({ id, words }) => { essayId = id; state.phase = 'thinking'; state.words = words },
      onText: text => { state.phase = 'writing'; state.text = text },
    })
    billing.refreshAllowances()
    // The connection broke after the essay was saved: the analysis goes on on the server, and its
    // page shows the result when it's ready (sending again would use the limit a second time).
    if (!res.ok && res.interrupted && essayId) {
      if (alive) router.push(essayRoute(essayId))
      return false
    }
    if (!res.ok) {
      state.phase = 'idle'
      state.error = res.error
      return false
    }
    state.phase = 'done'
    onSuccess?.()
    if (alive) router.push(essayRoute(res.id))
    return true
  }

  return { state, run, busy: computed(() => state.phase !== 'idle') }
}
