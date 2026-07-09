import type { PromptDefinition } from '../types'
import { releaseOrRemove } from './button-manager'

// Clear out any existing instances of our UI (guards against duplicates).
export function cleanupExistingElements(): void {
  const existingContainers = document.querySelectorAll('#comment-summarizer-container')
  existingContainers.forEach((container) => {
    console.debug('Clearing existing container')
    releaseOrRemove(container)
  })

  // Also remove any orphaned styles
  const existingStyles = document.querySelectorAll('style[data-comment-summarizer]')
  existingStyles.forEach((style) => style.remove())
}

export function areCommentsLoaded(): boolean {
  return document.querySelectorAll('.Comment__text').length > 0
}

export function hasShowCommentsButton(): boolean {
  return !!document.querySelector('.Episode-commentsShow')
}

export function getPromptDisplayName(prompts: PromptDefinition[], promptId: string): string {
  return prompts.find((p) => p.id === promptId)?.name ?? 'Summarize Comments'
}
