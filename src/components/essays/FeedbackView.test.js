import { describe, expect, it } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import FeedbackView from './FeedbackView.vue'
import { essay299, detectedFeedback } from '../../../tests/fixtures/essay-feedback'
import { countWords } from '@shared/essay'
import { finalizeDetectedFeedback } from '@shared/essay-reconciliation'

async function render(content = essay299) {
  const ai = detectedFeedback()
  if (countWords(content) >= 300) ai.top_tip = 'Rozwiń analizę.'
  const feedback = await finalizeDetectedFeedback('polish_basic', ai, { content, words: countWords(content), hasPrompt: true }, async () => ({ criteria: [{ id: 'style', points: 0, comment: 'Potoczne „totalnie straszne” osłabia styl.' }] }))
  return { feedback, html: await renderToString(createSSRApp(FeedbackView, { feedback, content, wordCount: countWords(content) })) }
}
const criteria = html => html.split(/<li\b[^>]*class="criterion"[^>]*>/).slice(1).map(part => part.split('</li>')[0])

describe('rendered essay feedback', () => {
  it('labels every length-zeroed criterion and qualifies its positive feedback', async () => {
    const { feedback, html } = await render()
    expect(feedback.total).toBe(7)
    expect(criteria(html).slice(2)).toHaveLength(6)
    for (const block of criteria(html).slice(2)) {
      expect(block).toContain('nieoceniane – za mało wyrazów')
      expect(block).toContain('0 pkt, ponieważ tekst ma mniej niż 300 wyrazów')
      expect(block).toContain('Informacyjnie — gdyby tekst spełniał limit:')
      expect(block).not.toContain('do poprawy')
    }
    expect(criteria(html)[2]).toContain('Zachowujesz czytelny podział')
  })

  it('puts Wogóle in spelling and retains the independent style observation', async () => {
    const { html } = await render()
    const rows = criteria(html)
    expect(rows[4]).not.toContain('Wogóle')
    expect(rows[4]).toContain('totalnie straszne')
    expect(rows[6]).toContain('Wogóle')
  })

  it('renders the prominent length warning as the first improvement, above criteria', async () => {
    const { html } = await render()
    const improvements = html.slice(html.indexOf('Najważniejsze do poprawy'), html.indexOf('Kryterium po kryterium'))
    expect(improvements).toContain('299 / 300 wyrazów')
    const firstItem = improvements.match(/<li[^>]*>(.*?)<\/li>/s)[1]
    expect(firstItem).toContain('Pozostałe kryteria otrzymują 0 pkt')
    expect(firstItem).toContain('18 pkt')
  })

  it('renders normal scores and no word-limit message at 300 words', async () => {
    const { html } = await render(`${essay299} Naprawdę.`)
    expect(html).not.toContain('nieoceniane – za mało wyrazów')
    expect(html).not.toContain('0 pkt, ponieważ tekst ma mniej')
    expect(html).not.toContain('Gdyby tekst spełniał')
    expect(html).not.toContain('300 wyrazów')
    expect(criteria(html)[2]).toContain('dobrze')
    expect(criteria(html)[2]).toContain('3/3')
  })
})
