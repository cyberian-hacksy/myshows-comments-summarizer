import { beforeEach, describe, expect, it } from 'vitest'
import { confirmDialog, unsavedChangesDialog } from '../src/ui/confirm-dialog'

function click(selector: string): void {
  const target = document.querySelector<HTMLElement>(selector)
  if (!target) throw new Error(`No element matches ${selector}`)
  target.click()
}

describe('confirmDialog', () => {
  beforeEach(() => {
    document.body.replaceChildren()
  })

  it('resolves true when confirmed and removes the dialog', async () => {
    const result = confirmDialog({ title: 'Delete prompt', message: 'Sure?', confirmLabel: 'Delete' })
    expect(document.querySelector('.mcs-dialog')).not.toBeNull()
    click('[data-action="confirm"]')
    await expect(result).resolves.toBe(true)
    expect(document.querySelector('.mcs-dialog')).toBeNull()
  })

  it('resolves false when cancelled', async () => {
    const result = confirmDialog({ title: 'Delete prompt', message: 'Sure?' })
    click('[data-action="cancel"]')
    await expect(result).resolves.toBe(false)
  })

  it('resolves false on Escape', async () => {
    const result = confirmDialog({ title: 'Delete prompt', message: 'Sure?' })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await expect(result).resolves.toBe(false)
    expect(document.querySelector('.mcs-dialog')).toBeNull()
  })

  it('marks the confirm button as dangerous when asked', () => {
    void confirmDialog({ title: 'Delete', message: 'Sure?', danger: true })
    expect(
      document.querySelector('[data-action="confirm"]')?.classList.contains('mcs-btn-danger'),
    ).toBe(true)
    click('[data-action="cancel"]')
  })

  it('shows the prompt message text', () => {
    void confirmDialog({ title: 'Delete', message: 'This cannot be undone.' })
    expect(document.querySelector('.mcs-dialog')?.textContent).toContain('This cannot be undone.')
    click('[data-action="cancel"]')
  })
})

describe('unsavedChangesDialog', () => {
  beforeEach(() => {
    document.body.replaceChildren()
  })

  it.each([
    ['save', 'save'],
    ['discard', 'discard'],
    ['cancel', 'cancel'],
  ] as const)('resolves %s when that button is clicked', async (action, expected) => {
    const result = unsavedChangesDialog()
    click(`[data-action="${action}"]`)
    await expect(result).resolves.toBe(expected)
    expect(document.querySelector('.mcs-dialog')).toBeNull()
  })

  it('resolves cancel on Escape', async () => {
    const result = unsavedChangesDialog()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await expect(result).resolves.toBe('cancel')
  })
})
