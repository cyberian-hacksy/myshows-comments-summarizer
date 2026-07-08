import { describe, expect, test } from 'vitest'
import { BUILTIN_PROMPTS, mergePrompts, renderPrompt } from '../src/prompts'
import type { Comment } from '../src/types'

const comments: Comment[] = [
  { text: 'Great episode', rating: '5' },
  { text: 'Meh', rating: 'No rating' },
]

describe('renderPrompt', () => {
  test('substitutes count, comments and language placeholders', () => {
    const prompt = {
      id: 'x',
      name: 'X',
      builtin: false,
      template: '{count} comments in {language}:\n{comments}',
    }
    const result = renderPrompt(prompt, comments, 'french')
    expect(result).toContain('2 comments in french:')
    expect(result).toContain('Comment 1: Great episode\nRating: 5')
    expect(result).toContain('Comment 2: Meh\nRating: No rating')
  })

  test('uses the real comment count, not the string length', () => {
    const prompt = BUILTIN_PROMPTS.find((p) => p.id === 'default')!
    expect(renderPrompt(prompt, comments, 'english')).toContain('Here are 2 comments')
  })

  test('defaults to english when no language is given', () => {
    const prompt = { id: 'x', name: 'X', builtin: false, template: '{language}' }
    expect(renderPrompt(prompt, comments, '')).toBe('english')
  })

  test('truncates comments longer than 300 characters', () => {
    const long: Comment[] = [{ text: 'x'.repeat(400), rating: '1' }]
    const prompt = { id: 'x', name: 'X', builtin: false, template: '{comments}' }
    const rendered = renderPrompt(prompt, long, 'english')
    expect(rendered).toContain('x'.repeat(300) + '...')
    expect(rendered).not.toContain('x'.repeat(301))
  })
})

describe('BUILTIN_PROMPTS', () => {
  test('exposes the four built-in prompt types', () => {
    expect(BUILTIN_PROMPTS.map((p) => p.id)).toEqual([
      'default',
      'topComments',
      'criticAnalysis',
      'episodeRating',
    ])
    for (const prompt of BUILTIN_PROMPTS) {
      expect(prompt.builtin).toBe(true)
      expect(prompt.template).toContain('{comments}')
      expect(prompt.template).toContain('{count}')
      expect(prompt.template).toContain('{language}')
    }
  })
})

describe('mergePrompts', () => {
  test('returns builtins untouched with no overrides or customs', () => {
    expect(mergePrompts({}, [])).toEqual(BUILTIN_PROMPTS)
  })

  test('applies overrides to builtins and appends customs', () => {
    const merged = mergePrompts({ default: { name: 'My Summary' } }, [
      { id: 'custom-1', name: 'Mine', builtin: false, template: 't' },
    ])
    expect(merged.find((p) => p.id === 'default')!.name).toBe('My Summary')
    expect(merged.find((p) => p.id === 'default')!.builtin).toBe(true)
    expect(merged.at(-1)!.id).toBe('custom-1')
  })

  test('does not mutate the builtin definitions', () => {
    mergePrompts({ default: { name: 'Changed' } }, [])
    expect(BUILTIN_PROMPTS.find((p) => p.id === 'default')!.name).toBe('Summarize Comments')
  })
})
