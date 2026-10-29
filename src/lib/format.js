// Small Polish formatting helpers shared by all pages.

const dateFmt = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })
const shortFmt = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short' })
const dateTimeFmt = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export const formatDate = d => (d ? dateFmt.format(new Date(d)) : '')
export const formatShortDate = d => (d ? shortFmt.format(new Date(d)) : '')
export const formatDateTime = d => (d ? dateTimeFmt.format(new Date(d)) : '')

/** plural(5, ['fiszka', 'fiszki', 'fiszek']) → 'fiszek' (Polish plural rules). */
export function plural(n, [one, few, many]) {
  if (n === 1) return one
  const last = n % 10
  const lastTwo = n % 100
  return last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14) ? few : many
}
/** count(5, ['fiszka', 'fiszki', 'fiszek']) → '5 fiszek' */
export const count = (n, forms) => `${n} ${plural(n, forms)}`

/** "przed chwilą", "5 min temu", "wczoraj", "3 dni temu", or a date. */
export function timeAgo(d, now = Date.now()) {
  const ms = now - new Date(d).getTime()
  const min = Math.round(ms / 60000)
  if (min < 1) return 'przed chwilą'
  if (min < 60) return `${min} min temu`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} godz. temu`
  const days = Math.round(h / 24)
  if (days === 1) return 'wczoraj'
  if (days < 7) return `${days} dni temu`
  return formatDate(d)
}

export const countWords = text => (text.trim() ? text.trim().split(/\s+/).length : 0)
