import { requestSummary } from '../openai'
import { computeCost, formatCost, loadPricing } from '../pricing'
import { DEFAULT_SYSTEM_PROMPT, mergePrompts, renderPrompt } from '../prompts'
import type { TokenUsage } from '../types'
import { getPromptState, getSettings } from '../storage'
import { getPromptDisplayName } from './dom-utils'
import { extractComments } from './extract-comments'

/**
 * Append the factual cost of the summary to the "N comments analyzed" note,
 * with a token breakdown in the tooltip. Falls back to a plain token count
 * when the model's pricing is unknown.
 */
async function showCost(
  commentCount: HTMLElement,
  commentsAnalyzed: number,
  model: string,
  usage: TokenUsage,
): Promise<void> {
  const pricing = (await loadPricing())[model]
  const spent = pricing
    ? formatCost(computeCost(pricing, usage))
    : `${usage.inputTokens + usage.outputTokens} tokens`
  commentCount.textContent = `${commentsAnalyzed} comments analyzed · ${spent}`

  const input =
    usage.cachedInputTokens > 0
      ? `${usage.inputTokens} input tokens (${usage.cachedInputTokens} cached)`
      : `${usage.inputTokens} input tokens`
  const output = usage.reasoningTokens
    ? `${usage.outputTokens} output tokens (${usage.reasoningTokens} reasoning)`
    : `${usage.outputTokens} output tokens`
  commentCount.title = `${input} · ${output}`
}

// Handle summarize button click.
export async function handleSummarizeClick(): Promise<void> {
  const button = document.getElementById('summarize-button') as HTMLButtonElement | null
  const buttonIcon = document.getElementById('button-icon')
  const buttonText = document.getElementById('button-text')
  const spinner = document.getElementById('loading-spinner')
  const summaryContainer = document.getElementById('summary-container')
  const summaryContent = document.getElementById('summary-content')
  const commentCount = document.getElementById('comment-count')

  if (!button || !spinner || !summaryContainer || !summaryContent || !buttonIcon || !buttonText || !commentCount) {
    console.error('Required elements not found')
    return
  }

  const settings = await getSettings()
  const promptState = await getPromptState()
  const prompts = mergePrompts(promptState.overrides, promptState.customs)
  const prompt =
    prompts.find((p) => p.id === settings.selectedPromptId) ??
    prompts.find((p) => p.id === 'default')!
  const idleLabel = getPromptDisplayName(prompts, prompt.id)

  console.debug('Summarize button clicked with prompt:', prompt.id)

  const resetButton = () => {
    spinner.style.display = 'none'
    buttonIcon.style.display = 'inline-flex'
    summaryContainer.classList.remove('is-loading')
    buttonText.textContent = idleLabel
    button.disabled = false
  }

  // Show loading state: the spinner replaces the icon, and the summary card
  // gets an animated gradient border via the is-loading class.
  spinner.style.display = 'inline-block'
  buttonIcon.style.display = 'none'
  summaryContainer.classList.add('is-loading')
  buttonText.textContent = 'Analyzing...'
  button.disabled = true

  const comments = extractComments()

  if (comments.length === 0) {
    resetButton()
    alert('No comments found on this page.')
    return
  }

  commentCount.textContent = `${comments.length} comments analyzed`

  // Show summary container with loading message
  summaryContent.textContent = 'Generating summary...'
  summaryContainer.style.display = 'block'

  try {
    if (!settings.openaiApiKey) {
      throw new Error('No API key found. Please set your OpenAI API key in the extension options.')
    }

    console.debug(
      `Using model: ${settings.selectedModel}, prompt: ${prompt.id}, language: ${settings.summaryLanguage}`,
    )

    const { text, usage } = await requestSummary({
      apiKey: settings.openaiApiKey,
      model: settings.selectedModel,
      system: promptState.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
      user: renderPrompt(prompt, comments, settings.summaryLanguage),
      temperature: settings.temperature,
      maxTokens: settings.maxTokens,
    })

    summaryContent.textContent = text
    if (usage) await showCost(commentCount, comments.length, settings.selectedModel, usage)
  } catch (error) {
    console.error('Error generating summary:', error)
    const message = error instanceof Error ? error.message : ''

    let errorMessage = 'Error generating summary. '
    if (message.includes('API key')) {
      errorMessage += 'Click the extension icon in the toolbar to set your OpenAI API key.'
    } else {
      errorMessage += message || 'Please try again.'
    }
    summaryContent.textContent = errorMessage
  } finally {
    resetButton()
  }
}
