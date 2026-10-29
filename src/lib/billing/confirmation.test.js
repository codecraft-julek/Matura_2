import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPaymentConfirmation } from './confirmation'

const flush = async () => { await Promise.resolve(); await Promise.resolve() }
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }

describe('payment confirmation', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  function setup(overrides = {}) {
    const loadBilling = vi.fn().mockResolvedValue({ premium: false })
    const onChange = vi.fn()
    const onActive = vi.fn()
    const controller = createPaymentConfirmation({ loadBilling, onChange, onActive, ...overrides })
    return { loadBilling, onChange, onActive, ...controller }
  }

  it('waits for webhook-backed access instead of trusting a return URL', async () => {
    const c = setup()
    c.loadBilling.mockResolvedValueOnce({ premium: false }).mockResolvedValueOnce({ premium: true, kind: 'pass' })
    c.start()
    await flush()
    expect(c.onActive).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(2000)
    expect(c.onChange).toHaveBeenLastCalledWith('done', { premium: true, kind: 'pass' })
    expect(c.onActive).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(c.loadBilling).toHaveBeenCalledTimes(2)
  })

  it('ends the wait for delayed confirmation and allows a fresh retry', async () => {
    const c = setup()
    c.start()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(c.onChange).toHaveBeenLastCalledWith('slow', undefined)
    expect(c.onActive).not.toHaveBeenCalled()
    c.loadBilling.mockResolvedValue({ premium: true })
    c.start()
    await flush()
    expect(c.onChange).toHaveBeenLastCalledWith('done', { premium: true })
  })

  it('distinguishes connection failure from bank processing', async () => {
    const c = setup()
    c.loadBilling.mockRejectedValue(new Error('offline'))
    c.start()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(c.onChange).toHaveBeenLastCalledWith('error', undefined)
    expect(c.onActive).not.toHaveBeenCalled()
  })

  it('recovers after a temporary connection failure', async () => {
    const c = setup()
    c.loadBilling.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ premium: true })
    c.start()
    await vi.advanceTimersByTimeAsync(2000)
    expect(c.onChange).toHaveBeenLastCalledWith('done', { premium: true })
  })

  it('bounds even a hung network request and ignores its late response', async () => {
    const request = deferred()
    const c = setup({ loadBilling: () => request.promise })
    c.start()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(c.onChange).toHaveBeenLastCalledWith('slow', undefined)
    request.resolve({ premium: true })
    await flush()
    expect(c.onActive).not.toHaveBeenCalled()
    expect(c.onChange).toHaveBeenLastCalledWith('slow', undefined)
  })

  it('ignores an old request after retry and never overlaps polling requests', async () => {
    const first = deferred()
    const c = setup()
    c.loadBilling.mockReturnValueOnce(first.promise)
    c.start()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(c.loadBilling).toHaveBeenCalledTimes(1)
    c.start()
    await flush()
    first.resolve({ premium: true })
    await flush()
    expect(c.onActive).not.toHaveBeenCalled()
    c.stop()
  })

  it('stops all work when the page is left', async () => {
    const request = deferred()
    const c = setup({ loadBilling: () => request.promise })
    c.start()
    c.stop()
    request.resolve({ premium: true })
    await vi.advanceTimersByTimeAsync(60_000)
    expect(c.onChange).toHaveBeenCalledTimes(1)
    expect(c.onActive).not.toHaveBeenCalled()
  })

  it('does not imply a payment occurred on a direct visit without a session', async () => {
    const c = setup({ hasSession: false })
    c.start()
    await flush()
    expect(c.onChange).toHaveBeenLastCalledWith('inactive', undefined)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(c.loadBilling).toHaveBeenCalledTimes(1)
  })

  it('still shows existing access on a direct visit', async () => {
    const c = setup({ hasSession: false })
    c.loadBilling.mockResolvedValue({ premium: true })
    c.start()
    await flush()
    expect(c.onChange).toHaveBeenLastCalledWith('done', { premium: true })
  })
})
