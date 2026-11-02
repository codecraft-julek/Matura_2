import { describe, expect, it } from 'vitest'
import { requestEssayCheck, takeEssayCheck } from './autoEssay'

describe('automatic essay check after handing in', () => {
  it('gives the topic once, so a reopened result never uses the limit again', () => {
    requestEssayCheck('a1', 'Temat')
    expect(takeEssayCheck('a1')).toEqual({ prompt: 'Temat' })
    expect(takeEssayCheck('a1')).toBeNull()
  })
  it('works without a topic and ignores other attempts', () => {
    requestEssayCheck('a2')
    expect(takeEssayCheck('a3')).toBeNull()
    expect(takeEssayCheck('a2')).toEqual({ prompt: '' })
  })
})
