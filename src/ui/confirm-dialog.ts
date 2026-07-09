// Promise-based modal dialogs replacing window.confirm(). One dialog at a
// time; Escape and overlay click resolve to the safe choice. All user-visible
// text is set via textContent — titles/messages may echo prompt names.

interface DialogButton<T> {
  action: string
  label: string
  value: T
  kind: 'primary' | 'quiet' | 'danger'
}

function openDialog<T>(
  title: string,
  message: string,
  buttons: DialogButton<T>[],
  safeValue: T,
): Promise<T> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div')
    overlay.className = 'mcs-dialog-overlay'

    const dialog = document.createElement('div')
    dialog.className = 'mcs-dialog'
    dialog.setAttribute('role', 'alertdialog')
    dialog.setAttribute('aria-modal', 'true')

    const heading = document.createElement('h2')
    heading.className = 'mcs-dialog-title'
    heading.textContent = title
    dialog.appendChild(heading)

    const body = document.createElement('p')
    body.className = 'mcs-dialog-message'
    body.textContent = message
    dialog.appendChild(body)

    const row = document.createElement('div')
    row.className = 'mcs-dialog-buttons'
    dialog.appendChild(row)

    const close = (value: T): void => {
      document.removeEventListener('keydown', onKeydown)
      overlay.remove()
      resolve(value)
    }

    const onKeydown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close(safeValue)
      }
    }

    const buttonClass = { primary: 'mcs-btn-primary', quiet: 'mcs-btn-quiet', danger: 'mcs-btn-danger' }
    let focusTarget: HTMLButtonElement | null = null
    for (const spec of buttons) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = `mcs-btn ${buttonClass[spec.kind]}`
      button.dataset.action = spec.action
      button.textContent = spec.label
      button.addEventListener('click', () => close(spec.value))
      row.appendChild(button)
      if (spec.value === safeValue) focusTarget = button
    }

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close(safeValue)
    })
    document.addEventListener('keydown', onKeydown)

    overlay.appendChild(dialog)
    document.body.appendChild(overlay)
    focusTarget?.focus()
  })
}

export interface ConfirmOptions {
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
}

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return openDialog<boolean>(
    options.title,
    options.message,
    [
      { action: 'cancel', label: 'Cancel', value: false, kind: 'quiet' },
      {
        action: 'confirm',
        label: options.confirmLabel ?? 'OK',
        value: true,
        kind: options.danger ? 'danger' : 'primary',
      },
    ],
    false,
  )
}

export type UnsavedChoice = 'save' | 'discard' | 'cancel'

export function unsavedChangesDialog(): Promise<UnsavedChoice> {
  return openDialog<UnsavedChoice>(
    'Unsaved changes',
    'This prompt has unsaved edits. Save them before switching?',
    [
      { action: 'cancel', label: 'Keep editing', value: 'cancel', kind: 'quiet' },
      { action: 'discard', label: 'Discard', value: 'discard', kind: 'danger' },
      { action: 'save', label: 'Save', value: 'save', kind: 'primary' },
    ],
    'cancel',
  )
}
