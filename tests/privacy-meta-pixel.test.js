import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { META_PIXEL_ID } from '../src/config/site'

let scripts
let sync
const calls = () => window.fbq.queue.map(args => Array.from(args))
const goTo = path => { window.location.pathname = path }

beforeEach(async () => {
  vi.resetModules()
  vi.stubEnv('PROD', true)
  scripts = []
  vi.stubGlobal('window', { location: { pathname: '/' } })
  vi.stubGlobal('document', { createElement: () => ({}), head: { appendChild: el => scripts.push(el) } })
  sync = (await import('../src/lib/privacy/metaPixel')).syncMetaPixel
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('Meta Pixel', () => {
  it('loads nothing without consent', () => {
    sync(false)
    expect(scripts).toEqual([])
    expect(window.fbq).toBeUndefined()
  })

  it('loads nothing on private pages, even with consent', () => {
    for (const path of ['/panel', '/konto', '/premium/gotowe', '/wypracowania/abc']) { goTo(path); sync(true) }
    expect(scripts).toEqual([])
    expect(window.fbq).toBeUndefined()
  })

  it('after consent loads Meta script once, with automatic capture off, and reports the page', () => {
    sync(true)
    expect(scripts.map(s => s.src)).toEqual(['https://connect.facebook.net/en_US/fbevents.js'])
    expect(window.fbq.disablePushState).toBe(true)
    expect(calls()).toEqual([
      ['set', 'autoConfig', false, META_PIXEL_ID],
      ['init', META_PIXEL_ID],
      ['consent', 'grant'],
      ['track', 'PageView'],
    ])
  })

  it('reports each public page once and stays silent on private ones', () => {
    sync(true)
    sync(true) // the first route change and the consent check see the same page
    goTo('/kontakt'); sync(true)
    goTo('/panel'); sync(true)
    goTo('/kontakt'); sync(true)
    expect(calls().filter(c => c[0] === 'track')).toHaveLength(3)
    expect(scripts).toHaveLength(1)
  })

  it('stops after the consent is withdrawn and can be turned on again', () => {
    sync(true)
    sync(false)
    goTo('/kontakt'); sync(false)
    expect(calls().filter(c => c[0] === 'track')).toHaveLength(1)
    expect(calls().at(-1)).toEqual(['consent', 'revoke'])
    sync(true)
    expect(calls().slice(-2)).toEqual([['consent', 'grant'], ['track', 'PageView']])
    expect(scripts).toHaveLength(1)
  })

  it('does nothing outside the production build', () => {
    vi.stubEnv('PROD', false)
    sync(true)
    expect(scripts).toEqual([])
  })
})
