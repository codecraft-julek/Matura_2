import { test } from 'vitest'
import assert from 'node:assert/strict'
import { questions } from '../src/exam/examData.js'
import { createSession, isAnswered, pointsFor, restoreSession, totalScore } from '../src/exam/session.js'

// A P/F question shape the session logic supports even though the current sheet selection has none.
const booleanQuestion = { id: 'pf', type: 'boolean', statements: [{ id: 'person', correct: true }, { id: 'proof', correct: false }] }

test('wynik liczy tylko zadania zamknięte i nie ocenia tekstów otwartych', () => {
  const answers = {}
  for (const question of questions) {
    answers[question.id] = question.type === 'choice' ? question.correct : 'Dowolny tekst, którego program nie powinien oceniać.'
  }
  const closed = questions.filter(question => question.type === 'choice').length
  assert.equal(closed, 2)
  assert.deepEqual(totalScore(answers), { earned: closed, max: closed })
  assert.deepEqual(totalScore({}), { earned: 0, max: closed })
  assert.equal(pointsFor(questions.find(question => question.type === 'open'), 'Tekst'), null)
})

test('zadania zamknięte mają klucz zgodny z zasadami oceniania CKE', () => {
  assert.equal(questions.find(question => question.id === 'zad-9').correct, 'b')
  assert.equal(questions.find(question => question.id === 'zad-13-2').correct, 'd')
  for (const question of questions) {
    assert.match(question.sourceTask, /^\d+(\.\d+)?$/)
    if (question.type === 'open') assert.ok(question.model && question.criteria.length >= 2, question.id)
    if (question.type === 'choice') assert.ok(question.options.some(option => option.id === question.correct), question.id)
  }
})

test('fałsz jest prawidłową odpowiedzią; częściowe P/F nie jest ukończone', () => {
  assert.equal(isAnswered(booleanQuestion, { person: true }), false)
  assert.equal(isAnswered(booleanQuestion, { person: true, proof: false }), true)
  assert.deepEqual(pointsFor(booleanQuestion, { person: true, proof: true }), { earned: 1, max: 2 })
  assert.equal(isAnswered(booleanQuestion, { person: 'true', proof: 'false' }), false)
})

test('puste odpowiedzi otwarte nie są uznawane za uzupełnione', () => {
  const question = questions.find(question => question.type === 'open')
  assert.equal(isAnswered(question, ' \n\t '), false)
  assert.equal(isAnswered(question, 'Własna odpowiedź.'), true)
})

test('odświeżenie zachowuje odpowiedzi, flagi, czas i samoocenę', () => {
  const session = createSession()
  session.activeId = 'zad-7'
  session.answers = { 'zad-9': 'b', 'zad-7': 'Moja odpowiedź.', 'zad-13-2': 'a' }
  session.checked = ['zad-7', 'zad-9', 'zad-13-2']
  session.flags = ['zad-7']
  session.selfAssessments = { 'zad-7': 'review' }
  session.elapsedSeconds = 135
  assert.deepEqual(restoreSession(JSON.stringify(session)), session)
})

test('uszkodzony lub obcy zapis nie psuje aplikacji', () => {
  assert.deepEqual(restoreSession('{nie-json'), createSession())
  assert.deepEqual(restoreSession('null'), createSession())
  assert.deepEqual(restoreSession('{"version":99}'), createSession())
  const restored = restoreSession(JSON.stringify({ version: 1, activeId: 'nieistniejące', answers: { 'zad-9': 'z', 'zad-7': 'x'.repeat(7000), antygona: 'stare id' }, checked: ['zad-9', 'zad-9', 'zad-7', 'obcy'], flags: ['zad-7', 'zad-7', 'obcy'], elapsedSeconds: -42, selfAssessments: { 'zad-16': 'understood' } }))
  assert.equal(restored.activeId, questions[0].id)
  assert.equal(restored.answers['zad-9'], undefined)
  assert.equal(restored.answers.antygona, undefined)
  assert.equal(restored.answers['zad-7'].length, 5000)
  assert.deepEqual(restored.checked, ['zad-7'])
  assert.deepEqual(restored.flags, ['zad-7'])
  assert.equal(restored.elapsedSeconds, 0)
  assert.deepEqual(restored.selfAssessments, {})
})
