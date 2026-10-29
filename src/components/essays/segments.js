// Splits the essay into plain text and highlighted parts: the first occurrence of each quote,
// overlapping quotes skipped. `n` is the quote's number in the original list (1-based), so the
// marks in the text match the numbered comments below it.

export function segments(content, highlights) {
  const ranges = []
  highlights.forEach((h, i) => {
    if (!h.quote) return
    const start = content.indexOf(h.quote)
    if (start === -1) return
    const end = start + h.quote.length
    if (ranges.some(r => start < r.end && end > r.start)) return
    ranges.push({ start, end, h, n: i + 1 })
  })
  ranges.sort((a, b) => a.start - b.start)

  const out = []
  let pos = 0
  for (const r of ranges) {
    if (r.start > pos) out.push({ text: content.slice(pos, r.start) })
    out.push({ text: content.slice(r.start, r.end), h: r.h, n: r.n })
    pos = r.end
  }
  if (pos < content.length) out.push({ text: content.slice(pos) })
  return out
}
