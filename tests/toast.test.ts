import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { showToast } from '../src/ui/toast'

describe('showToast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    document.body.innerHTML = ''
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the message in a toast element', () => {
    showToast('Saved.')
    const toast = document.querySelector('.mcs-toast')
    expect(toast?.textContent).toBe('Saved.')
  })

  it('marks error toasts with the error class', () => {
    showToast('Something broke', 'error')
    expect(document.querySelector('.mcs-toast')?.classList.contains('is-error')).toBe(true)
  })

  it('auto-dismisses after a short delay', () => {
    showToast('Saved.')
    expect(document.querySelector('.mcs-toast')).not.toBeNull()
    vi.runAllTimers()
    expect(document.querySelector('.mcs-toast')).toBeNull()
  })

  it('replaces a previous toast instead of stacking', () => {
    showToast('First')
    showToast('Second')
    const toasts = document.querySelectorAll('.mcs-toast')
    expect(toasts.length).toBe(1)
    expect(toasts[0]?.textContent).toBe('Second')
  })
})
