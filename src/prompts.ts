import type { Comment, PromptDefinition, PromptOverride } from './types'

export const DEFAULT_SYSTEM_PROMPT =
  'You are an AI assistant that specializes in analyzing user comments from a TV show website.'

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
    template: `Please analyze these comments and provide a summary that covers:
1. The overall sentiment (positive, negative, or mixed)
2. The main themes or topics discussed
3. Any consensus on the episode quality
4. Any interesting points or contradictions in the comments
5. The general comments trend

Never recommend to continue the dialogue or ask for more information.${SHARED_SUFFIX}`,
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
1. A thoughtful analysis of the episode based on viewer comments
2. Comparison to critical consensus (if apparent from comments)
3. Analysis of the episode's strengths and weaknesses mentioned
4. Context about how this episode fits into the show's narrative (if mentioned)
5. A final verdict summarizing the viewer reception${SHARED_SUFFIX}`,
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
5. A final verdict on whether the episode was generally well-received${SHARED_SUFFIX}`,
  },
]

const MAX_COMMENT_LENGTH = 300

export function formatComments(comments: Comment[]): string {
  return comments
    .map((c, i) => {
      const text =
        c.text.length > MAX_COMMENT_LENGTH
          ? c.text.slice(0, MAX_COMMENT_LENGTH) + '...'
          : c.text
      return `Comment ${i + 1}: ${text}\nRating: ${c.rating}`
    })
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
