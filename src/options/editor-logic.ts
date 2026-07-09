// Pure editor helpers for the prompt library page, kept out of the DOM-wiring
// code so they stay unit-testable.

export interface EditorFields {
  name: string
  template: string
}

export function isDirty(saved: EditorFields, current: EditorFields): boolean {
  return saved.name !== current.name || saved.template !== current.template
}

/** "Copy of X", then "Copy of X 2", "Copy of X 3", … until the name is free. */
export function duplicateName(baseName: string, existingNames: string[]): string {
  const taken = new Set(existingNames)
  const base = `Copy of ${baseName}`
  if (!taken.has(base)) return base
  let counter = 2
  while (taken.has(`${base} ${counter}`)) counter++
  return `${base} ${counter}`
}

/** Non-blocking template lint: a prompt without {comments} sends nothing to the model. */
export function templateWarning(template: string): string | null {
  if (template.includes('{comments}')) return null
  return 'No {comments} placeholder — the comments will not be included in the request.'
}

/** Insert text at the caret (replacing any selection) and move the caret after it. */
export function insertAtCursor(textarea: HTMLTextAreaElement, text: string): void {
  const start = textarea.selectionStart ?? textarea.value.length
  textarea.setRangeText(text, start, textarea.selectionEnd ?? start, 'end')
  textarea.focus()
  textarea.dispatchEvent(new Event('input', { bubbles: true }))
}
