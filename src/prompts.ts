import type { Comment, PromptDefinition, PromptOverride } from './types'

export const DEFAULT_SYSTEM_PROMPT =
  'You are an AI assistant that specializes in analyzing user comments from a TV show website. ' +
  'Be concise: state each piece of information exactly once and never repeat a point in different words across sections. ' +
  'Never ask follow-up questions or offer to continue the conversation.'

const SHARED_SUFFIX = `

Do not use markdown syntax.

Here are {count} comments about an episode from a TV show:

{comments}

Please provide the response in {language}.`

/** Skeleton used when the user creates a brand-new prompt. */
export const NEW_PROMPT_TEMPLATE = `Please analyze these comments.${SHARED_SUFFIX}`

export const BUILTIN_PROMPTS: PromptDefinition[] = [
  {
    id: 'default',
    name: 'Summarize Comments',
    builtin: true,
    template: `Please summarize these comments, covering:
1. Overall reception: the general sentiment and whether viewers considered the episode good, bad, or divisive
2. Main topics: what viewers discussed most (plot points, characters, theories), with the gist of what was said about each
3. Disagreements and standout remarks: points where commenters contradicted each other, plus any particularly funny comments
4. Discoveries and highlights: main insights, aha moments, wow effects, anything outstanding viewers noticed, interesting cameos, and unobvious references or easter eggs commenters pointed out

Each section must only contain information not already covered by another section. If a section has nothing new to add, omit it.${SHARED_SUFFIX}`,
  },
  {
    id: 'topComments',
    name: 'Top Comments',
    builtin: true,
    template: `Please analyze these comments and provide:
1. An exact quotation of the 10-20 top rated comments
2. Include the comment's rating
3. Focus on comments that provide unique perspectives or detailed analysis
4. Highlight any particularly funny or entertaining comments
5. Include a very brief overall sentiment summary at the end${SHARED_SUFFIX}`,
  },
  {
    id: 'criticAnalysis',
    name: 'Critic Analysis',
    builtin: true,
    template: `Please analyze these comments as a professional critic would and provide:
1. The episode's strengths and weaknesses as reported by viewers
2. How this episode fits into the show's narrative (only if comments mention it)
3. Comparison to critical consensus (only if apparent from comments)
4. A short final verdict on the overall viewer reception

Do not repeat the same observation in more than one section.${SHARED_SUFFIX}`,
  },
  {
    id: 'episodeRating',
    name: 'Episode Rating',
    builtin: true,
    template: `Please analyze these comments and provide:
1. The average rating based on numeric scores in comments
2. The distribution of ratings (how many high vs. low scores)
3. Key reasons for high ratings
4. Key reasons for low ratings
5. A one-sentence final verdict on whether the episode was generally well-received${SHARED_SUFFIX}`,
  },
]

export function formatComments(comments: Comment[]): string {
  return comments
    .map((c, i) => `Comment ${i + 1}: ${c.text}\nRating: ${c.rating}`)
    .join('\n\n')
}

export function renderPrompt(
  prompt: PromptDefinition,
  comments: Comment[],
  language: string,
): string {
  return prompt.template
    .replaceAll('{count}', String(comments.length))
    .replaceAll('{comments}', formatComments(comments))
    .replaceAll('{language}', language || 'english')
}

export function mergePrompts(
  overrides: Record<string, PromptOverride>,
  customs: PromptDefinition[],
): PromptDefinition[] {
  const builtins = BUILTIN_PROMPTS.map((p) => ({ ...p, ...overrides[p.id] }))
  return [...builtins, ...customs.map((c) => ({ ...c, builtin: false }))]
}
