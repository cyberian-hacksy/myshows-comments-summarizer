// Single transient status pill, bottom-center. A new toast replaces the
// previous one, so rapid saves never stack. Styling lives in theme.css.
const VISIBLE_MS = 2200
const LEAVE_MS = 200

let current: HTMLElement | null = null
let hideTimer: number | undefined
let removeTimer: number | undefined

export function showToast(message: string, kind: 'success' | 'error' = 'success'): void {
  clearTimeout(hideTimer)
  clearTimeout(removeTimer)
  current?.remove()

  const toast = document.createElement('div')
  toast.className = kind === 'error' ? 'mcs-toast is-error' : 'mcs-toast'
  toast.setAttribute('role', 'status')
  toast.textContent = message
  document.body.appendChild(toast)
  current = toast

  hideTimer = window.setTimeout(() => {
    toast.classList.add('is-leaving')
    removeTimer = window.setTimeout(() => {
      toast.remove()
      if (current === toast) current = null
    }, LEAVE_MS)
  }, VISIBLE_MS)
}
