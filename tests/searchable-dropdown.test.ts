import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createSearchableDropdown,
  type SearchableDropdown,
} from '../src/ui/searchable-dropdown'

const GROUPS = [
  {
    label: 'Full-sized models',
    options: [
      { value: 'gpt-5', label: 'gpt-5', sublabel: '$10.00' },
      { value: 'gpt-4o', label: 'gpt-4o', sublabel: '$10.00' },
    ],
  },
  {
    label: 'Smaller models',
    options: [{ value: 'gpt-5-mini', label: 'gpt-5-mini', sublabel: '$2.00', keywords: 'cheap' }],
  },
]

function setup(onSelect = vi.fn()): { dropdown: SearchableDropdown; onSelect: ReturnType<typeof vi.fn> } {
  document.body.replaceChildren()
  const dropdown = createSearchableDropdown({ placeholder: 'Pick a model', onSelect })
  document.body.appendChild(dropdown.element)
  dropdown.setGroups(GROUPS)
  return { dropdown, onSelect }
}

function trigger(): HTMLElement {
  return document.querySelector<HTMLElement>('.mcs-dd-trigger')!
}

function search(): HTMLInputElement {
  return document.querySelector<HTMLInputElement>('.mcs-dd-search')!
}

function visibleOptions(): string[] {
  return Array.from(document.querySelectorAll<HTMLElement>('.mcs-dd-option:not([hidden])')).map(
    (o) => o.dataset.value!,
  )
}

describe('createSearchableDropdown', () => {
  beforeEach(() => {
    document.body.replaceChildren()
  })

  it('shows the placeholder until something is selected', () => {
    setup()
    expect(trigger().textContent).toContain('Pick a model')
  })

  it('opens on trigger click and focuses the search field', () => {
    setup()
    trigger().click()
    expect(dropdownRoot().classList.contains('is-open')).toBe(true)
    expect(document.activeElement).toBe(search())
  })

  it('renders group headings and options', () => {
    setup()
    trigger().click()
    const headings = Array.from(document.querySelectorAll('.mcs-dd-group-label')).map(
      (h) => h.textContent,
    )
    expect(headings).toEqual(['Full-sized models', 'Smaller models'])
    expect(visibleOptions()).toEqual(['gpt-5', 'gpt-4o', 'gpt-5-mini'])
  })

  it('filters options by label and keywords, hiding empty groups', () => {
    setup()
    trigger().click()
    search().value = 'cheap'
    search().dispatchEvent(new Event('input', { bubbles: true }))
    expect(visibleOptions()).toEqual(['gpt-5-mini'])
    const headings = Array.from(
      document.querySelectorAll<HTMLElement>('.mcs-dd-group-label:not([hidden])'),
    ).map((h) => h.textContent)
    expect(headings).toEqual(['Smaller models'])
  })

  it('selects on option click: fires onSelect, updates trigger, closes', () => {
    const { onSelect } = setup()
    trigger().click()
    document.querySelector<HTMLElement>('.mcs-dd-option[data-value="gpt-4o"]')!.click()
    expect(onSelect).toHaveBeenCalledWith('gpt-4o')
    expect(trigger().textContent).toContain('gpt-4o')
    expect(dropdownRoot().classList.contains('is-open')).toBe(false)
  })

  it('setSelected updates the trigger without firing onSelect', () => {
    const { dropdown, onSelect } = setup()
    dropdown.setSelected('gpt-5-mini')
    expect(trigger().textContent).toContain('gpt-5-mini')
    expect(dropdown.getSelected()).toBe('gpt-5-mini')
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('keeps the selection when groups are repainted (e.g. price relabel)', () => {
    const { dropdown } = setup()
    dropdown.setSelected('gpt-4o')
    dropdown.setGroups(GROUPS)
    expect(dropdown.getSelected()).toBe('gpt-4o')
    expect(
      document
        .querySelector('.mcs-dd-option[data-value="gpt-4o"]')
        ?.classList.contains('is-selected'),
    ).toBe(true)
  })

  it('supports keyboard: ArrowDown into the list, Enter selects, Escape closes', () => {
    const { onSelect } = setup()
    trigger().click()
    search().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    const first = document.querySelector<HTMLElement>('.mcs-dd-option[data-value="gpt-5"]')!
    expect(document.activeElement).toBe(first)
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(onSelect).toHaveBeenCalledWith('gpt-5')
    trigger().click()
    search().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(dropdownRoot().classList.contains('is-open')).toBe(false)
  })

  it('closes when clicking outside', () => {
    setup()
    trigger().click()
    document.body.click()
    expect(dropdownRoot().classList.contains('is-open')).toBe(false)
  })
})

function dropdownRoot(): HTMLElement {
  return document.querySelector<HTMLElement>('.mcs-dd')!
}
