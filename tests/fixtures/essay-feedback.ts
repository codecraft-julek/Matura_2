import { readFileSync } from 'node:fs'
import { RUBRICS, type AiFeedback } from '../../supabase/functions/_shared/essay'
import type { DetectedIssue } from '../../supabase/functions/_shared/essay-issues'

export const essay299 = readFileSync(new URL('./polish-essay-299.txt', import.meta.url), 'utf8').trim()
// Representative frozen detector output, not a claim that a live model returned this exact JSON.
// Formal=1 and literary=6 reproduce the user's reported 7/35 before/after presentation changes.
export function issue(id: string, criterion: DetectedIssue['criterion'], quote: string, correction: string | null, comment = 'Wykryty błąd.'): DetectedIssue {
  return { id, criterion, quote, occurrence: 1, correction, comment, styleAfterCorrection: null }
}
export function detectedFeedback(): AiFeedback {
  const scores: Record<string, number> = { formal: 1, literary: 6, structure: 3, coherence: 1, style: 0, language: 4, spelling: 1, punctuation: 1 }
  return {
    summary: 'Przedstawiasz stanowisko i odwołujesz się do literatury.',
    criteria: RUBRICS.polish_basic.criteria.map(c => ({
      id: c.id, points: scores[c.id], verdict: 'good',
      comment: c.id === 'structure' ? 'Zachowujesz czytelny podział na wstęp, rozwinięcie i zakończenie.'
        : c.id === 'style' ? 'Potoczne „Wogóle” i „totalnie straszne” osłabiają styl.'
        : c.id === 'spelling' ? 'Popraw „Wogóle”, „napewno” i „żeczywistość”.' : 'Uwagi zgodne z oceną tego kryterium.',
    })),
    highlights: [
      { quote: 'Wogóle', type: 'issue', comment: 'Błąd ortograficzny: w ogóle.' },
      { quote: 'totalnie straszne', type: 'issue', comment: 'Potoczne sformułowanie.' },
    ],
    top_tip: 'Brakuje jednego wyrazu. Rozwiń analizę.',
    errors: [
      issue('spell-1', 'spelling', 'Wogóle', 'w ogóle', 'Błąd pisowni łącznej.'),
      issue('style-duplicate', 'style', 'Wogóle', 'w ogóle', 'Potoczne sformułowanie.'),
      issue('style-real', 'style', 'totalnie straszne', 'bardzo bolesne', 'Potoczne sformułowanie.'),
      issue('spell-2', 'spelling', 'napewno', 'na pewno'),
      issue('spell-3', 'spelling', 'żeczywistość', 'rzeczywistość'),
      issue('grammar', 'language', 'którą zakończyła się', 'która zakończyła się'),
      issue('phraseology', 'language', 'w każdym bądź razie', 'w każdym razie'),
      issue('pleonasm', 'language', 'cofnąć człowieka do tyłu', 'cofnąć człowieka'),
      issue('fact', 'literary', 'w 1944 roku', 'w 1943 roku'),
      issue('coherence', 'coherence', 'Tadka, który do końca pozostał wierny swoim zasadom', null),
    ],
  }
}
