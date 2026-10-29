// The return URL is navigation only. Access comes exclusively from webhook-backed billing data.
// Keep requests sequential, bound the wait even if a request hangs, and ignore stale responses.
export function createPaymentConfirmation({ loadBilling, onChange, onActive, hasSession = true, interval = 2000, timeout = 30_000 }) {
  let generation = 0
  let pollTimer
  let deadlineTimer
  let lastError = false

  function stop() {
    generation += 1
    clearTimeout(pollTimer)
    clearTimeout(deadlineTimer)
  }

  function finish(state, billing) {
    stop()
    onChange(state, billing)
    if (state === 'done') onActive?.()
  }

  async function check(run) {
    let billing
    try {
      billing = await loadBilling()
      if (run !== generation) return
      lastError = false
    } catch {
      if (run !== generation) return
      lastError = true
    }
    if (billing?.premium) return finish('done', billing)
    if (!hasSession) return finish(lastError ? 'error' : 'inactive')
    pollTimer = setTimeout(() => check(run), interval)
  }

  function start() {
    stop()
    lastError = false
    onChange('checking')
    const run = generation
    deadlineTimer = setTimeout(() => finish(lastError ? 'error' : 'slow'), timeout)
    void check(run)
  }

  return { start, stop }
}
