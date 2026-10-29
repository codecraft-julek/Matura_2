import { describe, expect, it } from 'vitest'
import { segments } from './segments'

const h = (quote, type = 'good') => ({ quote, type, comment: '' })

describe('segments', () => {
  it('returns the whole text when there are no highlights', () => {
    expect(segments('Ala ma kota.', [])).toEqual([{ text: 'Ala ma kota.' }])
  })

  it('marks quotes in text order and keeps their original numbers', () => {
    const out = segments('Ala ma kota, a kot ma Alę.', [h('kot ma Alę', 'issue'), h('Ala ma')])
    expect(out.map(s => s.text)).toEqual(['Ala ma', ' kota, a ', 'kot ma Alę', '.'])
    expect(out[0].n).toBe(2)
    expect(out[2].n).toBe(1)
    expect(out[2].h.type).toBe('issue')
  })

  it('skips overlapping and missing quotes', () => {
    const out = segments('abcdef', [h('abcd'), h('cdef'), h('xyz')])
    expect(out.map(s => s.text)).toEqual(['abcd', 'ef'])
  })

  it('joins back to the original text', () => {
    const text = 'Pierwsze zdanie. Drugie zdanie. Trzecie.'
    expect(segments(text, [h('Drugie'), h('Trzecie')]).map(s => s.text).join('')).toBe(text)
  })
})
