// Mutable state for the content script.

// SSR hydration adopts foreign DOM nodes it finds inside the app root, so the
// very first insertion waits this long after the comments section appears.
// Subsequent insertions (SPA navigation) are immediate — hydration runs once.
export const HYDRATION_GRACE_MS = 1000

interface ContentState {
  buttonAdded: boolean
  isAddingButton: boolean
  buttonCheckInterval: number | null
  /** Cancels the currently armed watchFor() watcher, if any. */
  cancelWatch: (() => void) | null
  /** True once the one-time hydration grace period has passed. */
  hydrationGraceElapsed: boolean
  hydrationGraceTimer: number | null
}

export const state: ContentState = {
  buttonAdded: false,
  isAddingButton: false,
  buttonCheckInterval: null,
  cancelWatch: null,
  hydrationGraceElapsed: false,
  hydrationGraceTimer: null,
}
