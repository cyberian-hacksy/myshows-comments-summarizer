// Configuration and mutable state for the content script.

// Wait time before even trying to add the button (let frameworks initialize)
export const INITIAL_DELAY = 2000 // 2 seconds

// Time to observe the page for stability before adding button
export const STABILITY_WAIT_TIME = 1000 // 1 second

// What we consider a "stable" page (no DOM changes for this duration)
export const STABILITY_THRESHOLD = 500 // 0.5 seconds

interface ContentState {
  buttonAdded: boolean
  isAddingButton: boolean
  buttonCheckInterval: number | null
  stabilityObserver: MutationObserver | null
  lastDomChangeTime: number
  stabilityTimer: number | null
}

export const state: ContentState = {
  buttonAdded: false,
  isAddingButton: false,
  buttonCheckInterval: null,
  stabilityObserver: null,
  lastDomChangeTime: 0,
  stabilityTimer: null,
}
