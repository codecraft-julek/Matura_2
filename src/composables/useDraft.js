// Keeps a form draft in localStorage (essay, note, new deck), so a refresh never loses work.
//   const draft = useDraft('essay-new', { topic: '', text: '' }); draft.value.text = '…'; draft.clear()

import { ref, watch } from 'vue'

export function useDraft(key, initial) {
  const storageKey = `ogarnij-mature:draft:${key}`
  let saved = null
  try { saved = JSON.parse(window.localStorage.getItem(storageKey) ?? 'null') } catch {}
  const draft = ref(saved && typeof saved === 'object' ? { ...initial, ...saved } : { ...initial })
  watch(draft, value => {
    try { window.localStorage.setItem(storageKey, JSON.stringify(value)) } catch {}
  }, { deep: true })
  draft.clear = () => {
    try { window.localStorage.removeItem(storageKey) } catch {}
    draft.value = { ...initial }
  }
  return draft
}
