// Re-runs `check()` every `interval` ms while `active()` is true (e.g. an essay still "pending"),
// up to `maxMs`. Stops on unmount.

import { onBeforeUnmount, watch } from 'vue'

export function usePolling(active, check, { interval = 3000, maxMs = 10 * 60 * 1000 } = {}) {
  let timer = null
  let started = 0
  const stop = () => { clearTimeout(timer); timer = null }
  const tick = async () => {
    if (!active() || Date.now() - started > maxMs) return stop()
    await check()
    if (active()) timer = setTimeout(tick, interval)
  }
  watch(active, value => {
    stop()
    if (value) { started = Date.now(); timer = setTimeout(tick, interval) }
  }, { immediate: true })
  onBeforeUnmount(stop)
  return stop
}
