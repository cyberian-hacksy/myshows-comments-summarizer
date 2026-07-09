import { describe, expect, it } from 'vitest'
import {
  duplicateName,
  insertAtCursor,
  isDirty,
  templateWarning,
} from '../src/options/editor-logic'

describe('isDirty', () => {
  const saved = { name: 'Summarize', template: 'Do it {comments}' }

  it('is false when fields match the saved prompt', () => {
    expect(isDirty(saved, { name: 'Summarize', template: 'Do it {comments}' })).toBe(false)
  })

  it('is true when the name changed', () => {
    expect(isDirty(saved, { name: 'Summarize!', template: 'Do it {comments}' })).toBe(true)
  })

  it('is true when the template changed', () => {
    expect(isDirty(saved, { name: 'Summarize', template: 'Do more {comments}' })).toBe(true)
  })
})

describe('duplicateName', () => {
  it('prefixes with "Copy of"', () => {
    expect(duplicateName('Top Comments', [])).toBe('Copy of Top Comments')
  })

  it('adds a counter when the copy name is taken', () => {
    expect(duplicateName('Top Comments', ['Copy of Top Comments'])).toBe('Copy of Top Comments 2')
  })

  it('keeps counting past existing numbered copies', () => {
    expect(
      duplicateName('Top Comments', ['Copy of Top Comments', 'Copy of Top Comments 2']),
    ).toBe('Copy of Top Comments 3')
  })
})

describe('templateWarning', () => {
  it('warns when {comments} is missing', () => {
    expect(templateWarning('Summarize please')).toMatch(/\{comments\}/)
  })

  it('returns null when {comments} is present', () => {
    expect(templateWarning('Summarize {comments}')).toBeNull()
  })
})

describe('insertAtCursor', () => {
  it('inserts at the caret and moves the caret after the inserted text', () => {
    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    textarea.value = 'Hello world'
    textarea.setSelectionRange(5, 5)

    insertAtCursor(textarea, ' {count}')

    expect(textarea.value).toBe('Hello {count} world')
    expect(textarea.selectionStart).toBe(13)
    expect(textarea.selectionEnd).toBe(13)
    textarea.remove()
  })

  it('replaces a selection', () => {
    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    textarea.value = 'Hello world'
    textarea.setSelectionRange(6, 11)

    insertAtCursor(textarea, '{language}')

    expect(textarea.value).toBe('Hello {language}')
    textarea.remove()
  })
})
