// A sheet was just handed in: its essay should be checked by AI when the result page opens.
// Kept in memory and read once, so reloading or reopening a result never uses the limit again.

const pending = new Map()

export const requestEssayCheck = (attemptId, prompt = '') => { pending.set(attemptId, prompt) }

/** → { prompt } the first time after requestEssayCheck, null otherwise. */
export function takeEssayCheck(attemptId) {
  if (!pending.has(attemptId)) return null
  const prompt = pending.get(attemptId)
  pending.delete(attemptId)
  return { prompt }
}
