import { describe, expect, it } from 'vitest'
import { verifyKey } from '../src/popup/verify-key'

describe('verifyKey', () => {
  it('rejects an empty key without calling the API', async () => {
    let called = false
    const result = await verifyKey('', async () => {
      called = true
      return []
    })
    expect(result.ok).toBe(false)
    expect(called).toBe(false)
  })

  it('reports success with the model count', async () => {
    const result = await verifyKey('sk-test', async () => ['gpt-5', 'gpt-4o'])
    expect(result).toEqual({ ok: true, modelCount: 2 })
  })

  it('reports failure when the API call throws', async () => {
    const result = await verifyKey('sk-bad', async () => {
      throw new Error('Failed to fetch models: 401')
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message.length).toBeGreaterThan(0)
  })
})
