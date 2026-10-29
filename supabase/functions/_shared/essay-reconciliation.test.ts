import { describe, expect, it, vi } from 'vitest'
import { essay299, detectedFeedback, issue } from '../../../tests/fixtures/essay-feedback'
import { countWords, applyCkeRules, feedbackForDisplay, priorityImprovements, criterionStatus, RUBRICS } from './essay'
import { citesIssue, deduplicateIssues } from './essay-issues'
import { finalizeDetectedFeedback } from './essay-reconciliation'

const reviseStyle = () => ({ criteria: [{ id: 'style', points: 0, comment: 'Potoczne „totalnie straszne” osłabia styl wypowiedzi.' }] })
const ctx = (content = essay299) => ({ content, words: countWords(content), hasPrompt: true })

describe('reported 299-word Polish essay', () => {
  it('preserves 7/35 and explains every zero caused by length (acceptance 1)', async () => {
    expect(countWords(essay299)).toBe(299)
    const before = detectedFeedback()
    const frozen = structuredClone(before)
    const feedback = await finalizeDetectedFeedback('polish_basic', before, ctx(), async () => reviseStyle())
    expect(before).toEqual(frozen)
    expect(feedback.total).toBe(7)
    expect(feedback.max).toBe(35)
    for (const c of feedback.criteria.filter(c => !['formal', 'literary'].includes(c.id))) {
      expect(c.points).toBe(0)
      expect(c.scoreReason).toBe('word_limit')
      expect(criterionStatus(c)).toBe('nieoceniane – za mało wyrazów')
      expect(c.scoreExplanation).toContain('mniej niż 300 wyrazów')
    }
    expect(feedback.criteria.find(c => c.id === 'structure')?.comment).toContain('czytelny podział')
  })

  it('assigns Wogóle only to spelling before revising the style score/comment (acceptance 2)', async () => {
    const revise = vi.fn(async request => {
      expect(request.criteria.map((c: { id: string }) => c.id)).toEqual(['style'])
      expect(request.criteria[0].errors.map((e: { quote: string }) => e.quote)).toEqual(['totalnie straszne'])
      return reviseStyle()
    })
    const feedback = await finalizeDetectedFeedback('polish_basic', detectedFeedback(), ctx(), revise)
    expect(revise).toHaveBeenCalledOnce()
    expect(feedback.errors?.filter(e => e.quote === 'Wogóle').map(e => e.criterion)).toEqual(['spelling'])
    expect(feedback.criteria.find(c => c.id === 'style')?.comment).not.toContain('Wogóle')
    expect(feedback.criteria.find(c => c.id === 'style')?.comment).toContain('totalnie straszne')
    expect(feedback.errors?.flatMap(e => e.sourceIds).sort()).toEqual(detectedFeedback().errors!.map(e => e.id).sort())
    expect(feedback.criteria.find(c => c.id === 'literary')?.points).toBe(6)
  })

  it('puts the counted length and score consequence before the qualitative tip (acceptance 3)', async () => {
    const feedback = await finalizeDetectedFeedback('polish_basic', detectedFeedback(), ctx(), async () => reviseStyle())
    const first = priorityImprovements(feedback)[0]
    expect(first).toContain('299 wyrazów')
    expect(first).toContain('Pozostałe kryteria otrzymują 0 pkt')
    expect(first).toContain('18 pkt')
    expect(priorityImprovements(feedback)[1]).toBe(detectedFeedback().top_tip)
  })

  it('also repairs a duplicated comment when the registry already assigns spelling correctly', async () => {
    const ai = detectedFeedback()
    ai.errors = ai.errors!.filter(e => e.id !== 'style-duplicate')
    const revise = vi.fn(async () => reviseStyle())
    const fb = await finalizeDetectedFeedback('polish_basic', ai, ctx(), revise)
    expect(revise).toHaveBeenCalledOnce()
    expect(fb.criteria.find(c => c.id === 'style')?.comment).not.toContain('Wogóle')
    expect(fb.total).toBe(7)
  })

  it('scores all criteria normally at exactly 300 words without length warnings (acceptance 4)', async () => {
    const content = `${essay299} Naprawdę.`
    expect(countWords(content)).toBe(300)
    const ai = detectedFeedback()
    ai.top_tip = 'Rozwiń analizę.'
    const feedback = await finalizeDetectedFeedback('polish_basic', ai, ctx(content), async () => reviseStyle())
    expect(feedback.total).toBe(17)
    expect(feedback.wordLimit).toBeUndefined()
    expect(feedback.notes).toEqual([])
    expect(feedback.criteria.every(c => c.assessed && !c.scoreReason)).toBe(true)
    expect(feedback.criteria.find(c => c.id === 'structure')?.points).toBe(3)
    expect(priorityImprovements(feedback)).toEqual(['Rozwiń analizę.'])
  })

  it('uses actual scores rather than independently generated verdicts', () => {
    const fb = applyCkeRules('polish_basic', detectedFeedback(), ctx(`${essay299} Naprawdę.`))
    expect(criterionStatus(fb.criteria.find(c => c.id === 'style')!)).toBe('do poprawy')
    expect(criterionStatus(fb.criteria.find(c => c.id === 'structure')!)).toBe('dobrze')
    expect(criterionStatus(fb.criteria.find(c => c.id === 'literary')!)).toBe('w porządku')
  })

  it('upgrades legacy display without rewriting its stored score or comments', () => {
    const legacy = applyCkeRules('polish_basic', detectedFeedback(), ctx())
    delete legacy.wordLimit
    legacy.criteria.forEach(c => { delete c.scoreReason; delete c.scoreExplanation; c.verdict = 'fix' })
    const display = feedbackForDisplay(legacy, 299)
    expect(display.total).toBe(7)
    expect(display.criteria.find(c => c.id === 'structure')?.scoreReason).toBe('word_limit')
    expect(legacy.criteria.find(c => c.id === 'structure')?.scoreReason).toBeUndefined()
  })

  it('does not invent errors or call reconciliation for a clean essay (acceptance 5)', async () => {
    const clean = { summary: 'Czytelna argumentacja.', criteria: RUBRICS.polish_basic.criteria.map(c => ({ id: c.id, points: c.max, verdict: 'good' as const, comment: 'Kryterium spełnione.' })), highlights: [], top_tip: 'Zachowaj ten sposób argumentacji.', errors: [] }
    const revise = vi.fn()
    const feedback = await finalizeDetectedFeedback('polish_basic', clean, ctx('Poprawny tekst. '.repeat(170)), revise)
    expect(feedback.errors).toEqual([])
    expect(feedback.highlights).toEqual([])
    expect(feedback.total).toBe(35)
    expect(revise).not.toHaveBeenCalled()
  })

  it('leaves word counting behavior unchanged for digits, Roman numerals, abbreviations and names', () => {
    // Regression locks the existing behavior; not an assertion of an explicit CKE rule for each form.
    expect(countWords('1944 XX II np. m.in. Herling-Grudziński')).toBe(6)
    expect(countWords('na pewno')).toBe(2)
    expect(countWords('napewno')).toBe(1)
  })
})

describe('deduplication preserves distinct detected errors', () => {
  it('matches citations case-insensitively but never matches a substring of another word', () => {
    expect(citesIssue('Potoczne „wogóle”.', 'Wogóle')).toBe(true)
    expect(citesIssue('Pomocne odwołanie.', 'moc')).toBe(false)
  })

  it('preserves structural advice outside the local-error registry', async () => {
    const ai = detectedFeedback()
    ai.highlights.push({ quote: 'Literatura pokazuje nam', type: 'issue', comment: 'Rozwiń wniosek.' })
    const fb = await finalizeDetectedFeedback('polish_basic', ai, ctx(), async () => reviseStyle())
    expect(fb.highlights).toContainEqual({ quote: 'Literatura pokazuje nam', type: 'issue', comment: 'Rozwiń wniosek.' })
  })

  it('retains a style issue only when the corrected spelling is independently inappropriate', () => {
    const spelling = issue('s', 'spelling', 'kórwa', 'kurwa', 'Błąd ortograficzny.')
    const style = { ...issue('t', 'style', 'kórwa', 'kurwa', 'Wulgaryzm.'), styleAfterCorrection: 'Poprawiona forma „kurwa” nadal jest wulgaryzmem.' }
    expect(deduplicateIssues([spelling, style], 'kórwa').issues).toHaveLength(2)
  })

  it('preserves separate occurrences of the same error', () => {
    const first = issue('one', 'spelling', 'Wogóle', 'w ogóle')
    const second = { ...first, id: 'two', occurrence: 2 }
    expect(deduplicateIssues([first, second], 'Wogóle i Wogóle').issues).toHaveLength(2)
  })

  it('does not merge different corrections within the same quoted phrase', () => {
    const a = issue('grammar', 'language', 'Ala który mówi że', 'Ala która mówi że')
    const b = issue('comma', 'punctuation', 'Ala który mówi że', 'Ala który mówi, że')
    expect(deduplicateIssues([a, b], 'Ala który mówi że').issues).toHaveLength(2)
  })

  it('deduplicates the same correction across categories without deleting its provenance', () => {
    const a = issue('a', 'language', 'cofnąć do tyłu', 'cofnąć')
    const b = issue('b', 'style', 'cofnąć do tyłu', 'cofnąć')
    const r = deduplicateIssues([b, a], 'cofnąć do tyłu')
    expect(r.issues).toHaveLength(1)
    expect(r.issues[0].criterion).toBe('language')
    expect(r.issues[0].sourceIds.sort()).toEqual(['a', 'b'])
  })

  it('rejects invented quote locations rather than inventing an error in the essay', () => {
    expect(() => deduplicateIssues([issue('fake', 'spelling', 'Wogóle', 'w ogóle')], 'Poprawny tekst.')).toThrow(/not in the essay/)
  })

  it('refuses a revised comment that reintroduces the removed style citation', async () => {
    await expect(finalizeDetectedFeedback('polish_basic', detectedFeedback(), ctx(), async () => ({ criteria: [{ id: 'style', points: 0, comment: 'Wogóle jest potoczne.' }] }))).rejects.toThrow(/duplicate error/)
  })

  it('refuses rescoring an unrelated criterion', async () => {
    await expect(finalizeDetectedFeedback('polish_basic', detectedFeedback(), ctx(), async () => ({ criteria: [{ id: 'literary', points: 16, comment: 'Nowa ocena.' }] }))).rejects.toThrow(/unrelated criteria/)
  })
})
