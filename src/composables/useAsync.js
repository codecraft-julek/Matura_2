// Loads data for a page with loading / error / reload, so every page handles states the same way.
//   const { data, loading, error, reload } = useAsync(() => listDecks(), { watch: () => route.params.id })
// `data` is a shallowRef: replace it (data.value = …) or call reload() after changes.

import { onMounted, ref, shallowRef, watch as vueWatch } from 'vue'

export function useAsync(loader, { watch: source, immediate = true } = {}) {
  const data = shallowRef(null)
  const loading = ref(immediate)
  const error = ref(null)
  let ticket = 0

  async function reload() {
    const mine = ++ticket
    loading.value = true
    error.value = null
    try {
      const result = await loader()
      if (mine === ticket) data.value = result
    } catch (e) {
      if (mine === ticket) { error.value = e; console.error(e) }
    } finally {
      if (mine === ticket) loading.value = false
    }
  }

  if (source) vueWatch(source, reload)
  if (immediate) onMounted(reload)
  return { data, loading, error, reload }
}
