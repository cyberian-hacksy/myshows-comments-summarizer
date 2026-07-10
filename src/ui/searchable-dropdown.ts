// Searchable dropdown with option groups, keyboard navigation, and ARIA
// combobox semantics. Generalizes the popup's old bespoke language picker so
// the language and model selectors share one implementation. All option text
// is set via textContent (labels may contain user/API-supplied strings).

export interface DropdownOption {
  value: string
  label: string
  /** Dimmed secondary text (e.g. a price) shown right-aligned. */
  sublabel?: string
  /** Extra search haystack (e.g. a language's native name or code). */
  keywords?: string
}

export interface DropdownGroup {
  /** Optional heading; groups without one render as a flat run of options. */
  label?: string
  options: DropdownOption[]
}

export interface SearchableDropdownConfig {
  placeholder?: string
  searchPlaceholder?: string
  onSelect: (value: string) => void
}

export interface SearchableDropdown {
  element: HTMLElement
  /** Repaint the option list; the current selection is kept if still present. */
  setGroups(groups: DropdownGroup[]): void
  /** Programmatic selection — updates the UI without firing onSelect. */
  setSelected(value: string): void
  getSelected(): string
}

export function createSearchableDropdown(config: SearchableDropdownConfig): SearchableDropdown {
  let groups: DropdownGroup[] = []
  let selected = ''

  const root = document.createElement('div')
  root.className = 'mcs-dd'

  const trigger = document.createElement('button')
  trigger.type = 'button'
  trigger.className = 'mcs-dd-trigger'
  trigger.setAttribute('role', 'combobox')
  trigger.setAttribute('aria-expanded', 'false')
  trigger.setAttribute('aria-haspopup', 'listbox')

  const triggerLabel = document.createElement('span')
  triggerLabel.className = 'mcs-dd-trigger-label'
  triggerLabel.textContent = config.placeholder ?? 'Select…'
  trigger.appendChild(triggerLabel)

  const chevron = document.createElement('span')
  chevron.className = 'mcs-dd-chevron'
  chevron.setAttribute('aria-hidden', 'true')
  trigger.appendChild(chevron)

  const panel = document.createElement('div')
  panel.className = 'mcs-dd-panel'
  panel.hidden = true

  const search = document.createElement('input')
  search.type = 'text'
  search.className = 'mcs-dd-search'
  search.placeholder = config.searchPlaceholder ?? 'Search…'
  search.setAttribute('aria-label', search.placeholder)
  panel.appendChild(search)

  const list = document.createElement('div')
  list.className = 'mcs-dd-list'
  list.setAttribute('role', 'listbox')
  panel.appendChild(list)

  root.append(trigger, panel)

  function isOpen(): boolean {
    return root.classList.contains('is-open')
  }

  function setOpen(open: boolean): void {
    root.classList.toggle('is-open', open)
    panel.hidden = !open
    trigger.setAttribute('aria-expanded', String(open))
    if (open) {
      search.value = ''
      applyFilter('')
      search.focus()
    }
  }

  function optionElements(): HTMLElement[] {
    return Array.from(list.querySelectorAll<HTMLElement>('.mcs-dd-option'))
  }

  function visibleOptionElements(): HTMLElement[] {
    return optionElements().filter((option) => !option.hidden)
  }

  function labelFor(value: string): string | undefined {
    for (const group of groups) {
      const match = group.options.find((option) => option.value === value)
      if (match) return match.label
    }
    return undefined
  }

  function refreshSelectionMarks(): void {
    for (const option of optionElements()) {
      const isSelected = option.dataset.value === selected
      option.classList.toggle('is-selected', isSelected)
      option.setAttribute('aria-selected', String(isSelected))
    }
    const label = labelFor(selected)
    if (label !== undefined) triggerLabel.textContent = label
  }

  function select(value: string): void {
    selected = value
    refreshSelectionMarks()
    setOpen(false)
    trigger.focus()
    config.onSelect(value)
  }

  function applyFilter(text: string): void {
    const needle = text.trim().toLowerCase()
    const groupBlocks = Array.from(list.querySelectorAll<HTMLElement>('.mcs-dd-group'))
    for (const block of groupBlocks) {
      let anyVisible = false
      for (const option of Array.from(block.querySelectorAll<HTMLElement>('.mcs-dd-option'))) {
        const haystack = option.dataset.haystack ?? ''
        const visible = !needle || haystack.includes(needle)
        option.hidden = !visible
        anyVisible ||= visible
      }
      const heading = block.querySelector<HTMLElement>('.mcs-dd-group-label')
      if (heading) heading.hidden = !anyVisible
      block.hidden = !anyVisible
    }
  }

  function focusOption(offset: number): void {
    const visible = visibleOptionElements()
    if (!visible.length) return
    const active = document.activeElement as HTMLElement
    const index = visible.indexOf(active)
    if (index === -1) {
      visible[0]?.focus()
      return
    }
    const next = index + offset
    if (next < 0) {
      search.focus()
    } else if (next < visible.length) {
      visible[next]?.focus()
    }
  }

  function renderGroups(): void {
    list.replaceChildren()
    for (const group of groups) {
      const block = document.createElement('div')
      block.className = 'mcs-dd-group'

      if (group.label) {
        const heading = document.createElement('div')
        heading.className = 'mcs-dd-group-label'
        heading.textContent = group.label
        block.appendChild(heading)
      }

      for (const optionSpec of group.options) {
        const option = document.createElement('div')
        option.className = 'mcs-dd-option'
        option.setAttribute('role', 'option')
        option.tabIndex = 0
        option.dataset.value = optionSpec.value
        option.dataset.haystack = `${optionSpec.label} ${optionSpec.keywords ?? ''}`.toLowerCase()

        const label = document.createElement('span')
        label.className = 'mcs-dd-option-label'
        label.textContent = optionSpec.label
        option.appendChild(label)

        if (optionSpec.sublabel) {
          const sublabel = document.createElement('span')
          sublabel.className = 'mcs-dd-option-sub'
          sublabel.textContent = optionSpec.sublabel
          option.appendChild(sublabel)
        }

        option.addEventListener('click', () => select(optionSpec.value))
        block.appendChild(option)
      }

      list.appendChild(block)
    }
    refreshSelectionMarks()
  }

  trigger.addEventListener('click', () => setOpen(!isOpen()))
  trigger.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' && !isOpen()) {
      event.preventDefault()
      setOpen(true)
    }
  })

  search.addEventListener('input', () => applyFilter(search.value))
  search.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      setOpen(false)
      trigger.focus()
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      visibleOptionElements()[0]?.focus()
    }
  })

  list.addEventListener('keydown', (event) => {
    const active = document.activeElement as HTMLElement
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      focusOption(1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      focusOption(-1)
    } else if ((event.key === 'Enter' || event.key === ' ') && active.dataset.value) {
      event.preventDefault()
      select(active.dataset.value)
    } else if (event.key === 'Escape') {
      setOpen(false)
      trigger.focus()
    }
  })

  document.addEventListener('click', (event) => {
    if (isOpen() && !root.contains(event.target as Node)) setOpen(false)
  })

  return {
    element: root,
    setGroups(next) {
      groups = next
      renderGroups()
    },
    setSelected(value) {
      selected = value
      refreshSelectionMarks()
    },
    getSelected() {
      return selected
    },
  }
}
