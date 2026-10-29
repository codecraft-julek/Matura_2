import { questions } from './examData.js'

export const STORAGE_KEY = 'ogarnij-mature:polski-2026:v1'

export function createSession() {
  return { version: 1, activeId: questions[0].id, answers: {}, checked: [], flags: [], selfAssessments: {}, elapsedSeconds: 0, complete: false }
}

export function isAnswered(question, answer) {
  if (question.type === 'choice') return question.options.some(option => option.id === answer)
  if (question.type === 'boolean') return !!answer && question.statements.every(statement => typeof answer[statement.id] === 'boolean')
  return typeof answer === 'string' && answer.trim().length > 0
}

export function pointsFor(question, answer) {
  if (question.type === 'open') return null
  if (question.type === 'choice') return { earned: answer === question.correct ? 1 : 0, max: 1 }
  return { earned: question.statements.filter(statement => answer?.[statement.id] === statement.correct).length, max: question.statements.length }
}

export function totalScore(answers) {
  return questions.reduce((score, question) => {
    const points = pointsFor(question, answers[question.id])
    if (points) { score.earned += points.earned; score.max += points.max }
    return score
  }, { earned: 0, max: 0 })
}

export function restoreSession(raw) {
  const clean = createSession()
  if (!raw) return clean
  try {
    const saved = JSON.parse(raw)
    if (!saved || saved.version !== 1) return clean
    if (questions.some(question => question.id === saved.activeId)) clean.activeId = saved.activeId
    for (const question of questions) {
      const value = saved.answers?.[question.id]
      if (question.type === 'choice' && isAnswered(question, value)) clean.answers[question.id] = value
      if (question.type === 'open' && typeof value === 'string') clean.answers[question.id] = value.slice(0, 5000)
      if (question.type === 'boolean' && value && typeof value === 'object') {
        clean.answers[question.id] = Object.fromEntries(question.statements.filter(item => typeof value[item.id] === 'boolean').map(item => [item.id, value[item.id]]))
      }
      if (Array.isArray(saved.checked) && saved.checked.includes(question.id) && isAnswered(question, clean.answers[question.id])) clean.checked.push(question.id)
      if (Array.isArray(saved.flags) && saved.flags.includes(question.id)) clean.flags.push(question.id)
      if (question.type === 'open' && clean.checked.includes(question.id) && ['understood', 'review'].includes(saved.selfAssessments?.[question.id])) clean.selfAssessments[question.id] = saved.selfAssessments[question.id]
    }
    if (Number.isFinite(saved.elapsedSeconds)) clean.elapsedSeconds = Math.max(0, Math.min(Math.floor(saved.elapsedSeconds), 604800))
    clean.complete = saved.complete === true && questions.some(question => isAnswered(question, clean.answers[question.id]))
    return clean
  } catch { return clean }
}
