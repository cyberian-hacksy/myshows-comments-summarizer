import type { Comment } from '../types'

// Extract all visible comments (with their ratings) from the page.
export function extractComments(): Comment[] {
  const comments: Comment[] = []

  try {
    const commentElements = document.querySelectorAll(
      '.Comment__text:not(.Comment__text--showable):not(.Comment__text--deleted)',
    )

    for (const element of Array.from(commentElements)) {
      const commentText = element.textContent?.trim() ?? ''

      // Find parent comment container
      let commentContainer: Element | null = element
      while (commentContainer && !commentContainer.classList.contains('Comment')) {
        commentContainer = commentContainer.parentElement
      }

      // Extract rating if available
      let rating = 'No rating'
      if (commentContainer) {
        const ratingElement = commentContainer.querySelector('.CommentRating__value')
        if (ratingElement) {
          rating = ratingElement.textContent?.trim() ?? rating
        }
      }

      if (commentText) {
        comments.push({ text: commentText, rating })
      }
    }

    console.debug(`Extracted ${comments.length} comments`)
  } catch (error) {
    console.error('Error extracting comments:', error)
  }

  return comments
}
