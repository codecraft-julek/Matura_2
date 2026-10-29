// App-wide UI state: toasts, the promise-based confirm dialog, and the docked tutor panel width.

import { defineStore } from 'pinia'
import { ref } from 'vue'

let nextId = 1

export const useUiStore = defineStore('ui', () => {
  const toasts = ref([])
  const confirmRequest = ref(null)
  const tutorDocked = ref(false)

  /** toast('Zapisano'), toast('Nie udało się…', 'error'). Tones: 'ok' | 'error' | 'info'. */
  function toast(message, tone = 'ok', timeout = 4500) {
    const id = nextId++
    toasts.value.push({ id, message, tone })
    if (timeout) setTimeout(() => dismiss(id), timeout)
    return id
  }
  function dismiss(id) { toasts.value = toasts.value.filter(t => t.id !== id) }

  /**
   * `if (await ui.confirm({ title, body, confirmLabel: 'Usuń', danger: true })) …`
   * Replaces window.confirm everywhere. Resolves true on confirm, false on cancel/Escape.
   */
  function confirm({ title, body = '', confirmLabel = 'Potwierdź', cancelLabel = 'Anuluj', danger = false }) {
    confirmRequest.value?.resolve(false)
    return new Promise(resolve => {
      confirmRequest.value = { title, body, confirmLabel, cancelLabel, danger, resolve }
    })
  }
  function settleConfirm(value) {
    confirmRequest.value?.resolve(value)
    confirmRequest.value = null
  }

  /** The docked tutor (≥1024px) reserves room on the right via --tutor-w (see styles/app.css). */
  function setTutorDocked(value) {
    tutorDocked.value = value
    document.documentElement.classList.toggle('tutor-docked', value)
  }

  return { toasts, toast, dismiss, confirmRequest, confirm, settleConfirm, tutorDocked, setTutorDocked }
})
