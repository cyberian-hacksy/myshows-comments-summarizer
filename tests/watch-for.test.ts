import { afterEach, describe, expect, test, vi } from 'vitest'
import { watchFor } from '../src/content/watch-for'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('watchFor', () => {
  test('fires synchronously when the condition already holds', () => {
    document.body.innerHTML = '<div id="comments"></div>'
    const onFound = vi.fn()

    watchFor(() => !!document.getElementById('comments'), onFound)

    expect(onFound).toHaveBeenCalledTimes(1)
  })

  test('does not fire while the condition is false', async () => {
    const onFound = vi.fn()

    watchFor(() => !!document.getElementById('comments'), onFound)
    document.body.appendChild(document.createElement('p'))
    await vi.waitFor(() => expect(document.querySelector('p')).toBeTruthy())

    expect(onFound).not.toHaveBeenCalled()
  })

  test('fires as soon as the element is added to the DOM', async () => {
    const onFound = vi.fn()

    watchFor(() => !!document.getElementById('comments'), onFound)
    const comments = document.createElement('div')
    comments.id = 'comments'
    document.body.appendChild(comments)

    await vi.waitFor(() => expect(onFound).toHaveBeenCalledTimes(1))
  })

  test('fires only once even when mutations continue', async () => {
    const onFound = vi.fn()

    watchFor(() => !!document.getElementById('comments'), onFound)
    const comments = document.createElement('div')
    comments.id = 'comments'
    document.body.appendChild(comments)
    await vi.waitFor(() => expect(onFound).toHaveBeenCalledTimes(1))

    document.body.appendChild(document.createElement('p'))
    document.body.appendChild(document.createElement('p'))
    await vi.waitFor(() => expect(document.querySelectorAll('p').length).toBe(2))

    expect(onFound).toHaveBeenCalledTimes(1)
  })

  test('cancel stops the watcher before the element appears', async () => {
    const onFound = vi.fn()

    const cancel = watchFor(() => !!document.getElementById('comments'), onFound)
    cancel()

    const comments = document.createElement('div')
    comments.id = 'comments'
    document.body.appendChild(comments)
    await vi.waitFor(() => expect(document.getElementById('comments')).toBeTruthy())

    expect(onFound).not.toHaveBeenCalled()
  })
})
