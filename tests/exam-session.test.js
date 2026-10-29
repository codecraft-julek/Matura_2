import { test } from 'vitest'
import assert from 'node:assert/strict'
import { questions } from '../src/exam/examData.js'
import { createSession, isAnswered, pointsFor, restoreSession, totalScore } from '../src/exam/session.js'

test('wynik nie ocenia tekstów otwartych i uwzględnia każde stwierdzenie P/F', () => {
  const answers = {}
  for (const question of questions) {
    answers[question.id] = question.type === 'choice' ? question.correct : question.type === 'boolean' ? Object.fromEntries(question.statements.map(item => [item.id, item.correct])) : 'Dowolny tekst, którego program nie powinien oceniać.'
  }
  assert.deepEqual(totalScore(answers), { earned: 7, max: 7 })
  assert.deepEqual(totalScore({}), { earned: 0, max: 7 })
  assert.equal(pointsFor(questions.find(question => question.type === 'open'), 'Tekst'), null)
})

test('fałsz jest prawidłową odpowiedzią; częściowe P/F nie jest ukończone', () => {
  const question = questions.find(question => question.type === 'boolean')
  assert.equal(isAnswered(question, { person: true }), false)
  assert.equal(isAnswered(question, { person: true, proof: false }), true)
  assert.deepEqual(pointsFor(question, { person: true, proof: true }), { earned: 1, max: 2 })
  assert.equal(isAnswered(question, { person: 'true', proof: 'false' }), false)
})

test('puste odpowiedzi otwarte nie są uznawane za uzupełnione', () => {
  const question = questions.find(question => question.type === 'open')
  assert.equal(isAnswered(question, ' \n\t '), false)
  assert.equal(isAnswered(question, 'Własna odpowiedź.'), true)
})

test('odświeżenie zachowuje odpowiedzi, flagi, czas i samoocenę', () => {
  const session = createSession()
  session.activeId = 'antygona'
  session.answers = { znaczenie: 'b', antygona: 'Moja odpowiedź.', argument: { person: true, proof: false } }
  session.checked = ['znaczenie', 'antygona', 'argument']
  session.flags = ['antygona']
  session.selfAssessments = { antygona: 'review' }
  session.elapsedSeconds = 135
  assert.deepEqual(restoreSession(JSON.stringify(session)), session)
})

test('uszkodzony lub obcy zapis nie psuje aplikacji', () => {
  assert.deepEqual(restoreSession('{nie-json'), createSession())
  assert.deepEqual(restoreSession('null'), createSession())
  assert.deepEqual(restoreSession('{"version":99}'), createSession())
  const restored = restoreSession(JSON.stringify({version: 1, activeId: 'nieistniejące', answers: { znaczenie: 'z', antygona: 'x'.repeat(7000), argument: { person: true, proof: 'false', obcy: true } }, checked: ['znaczenie', 'znaczenie', 'antygona', 'obcy'], flags: ['antygona', 'antygona', 'obcy'], elapsedSeconds: -42, selfAssessments: { propaganda: 'understood' } }))
  assert.equal(restored.activeId, questions[0].id)
  assert.equal(restored.answers.znaczenie, undefined)
  assert.equal(restored.answers.antygona.length, 5000)
  assert.deepEqual(restored.answers.argument, {person: true})
  assert.deepEqual(restored.checked, ['antygona'])
  assert.deepEqual(restored.flags, ['antygona'])
  assert.equal(restored.elapsedSeconds, 0)
  assert.deepEqual(restored.selfAssessments, {})
})
