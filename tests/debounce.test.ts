import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { debounce } from '../src/ui/debounce'

describe('debounce', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('fires once after the wait, with the latest arguments', () => {
    const spy = vi.fn()
    const debounced = debounce(spy, 500)
    debounced('a')
    debounced('b')
    debounced('c')
    expect(spy).not.toHaveBeenCalled()
    vi.advanceTimersByTime(500)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('c')
  })

  it('restarts the wait on each call', () => {
    const spy = vi.fn()
    const debounced = debounce(spy, 500)
    debounced('a')
    vi.advanceTimersByTime(400)
    debounced('b')
    vi.advanceTimersByTime(400)
    expect(spy).not.toHaveBeenCalled()
    vi.advanceTimersByTime(100)
    expect(spy).toHaveBeenCalledWith('b')
  })
})
