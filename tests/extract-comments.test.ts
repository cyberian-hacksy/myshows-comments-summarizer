import { describe, expect, test } from 'vitest'
import { extractComments } from '../src/content/extract-comments'

describe('extractComments', () => {
  test('extracts all comments with appropriate ratings', () => {
    document.body.innerHTML = `
      <div class="Comment"><div class="Comment__text">First comment</div><div class="CommentRating__value">5</div></div>
      <div class="Comment"><div class="Comment__text">Second comment</div><div class="CommentRating__value">7</div></div>
      <div class="Comment"><div class="Comment__text">Third comment</div></div>`
    expect(extractComments()).toEqual([
      { text: 'First comment', rating: '5' },
      { text: 'Second comment', rating: '7' },
      { text: 'Third comment', rating: 'No rating' },
    ])
  })

  test('skips hidden and deleted comments', () => {
    document.body.innerHTML = `
      <div class="Comment"><div class="Comment__text Comment__text--showable">Spoiler</div></div>
      <div class="Comment"><div class="Comment__text Comment__text--deleted">Deleted</div></div>
      <div class="Comment"><div class="Comment__text">Visible</div></div>`
    expect(extractComments().map((c) => c.text)).toEqual(['Visible'])
  })
})
