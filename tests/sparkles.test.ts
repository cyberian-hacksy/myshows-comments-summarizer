import { describe, expect, it } from 'vitest'
import { sparklesIcon } from '../src/ui/sparkles'

describe('sparklesIcon', () => {
  it('renders an svg sized to the requested pixel size', () => {
    const svg = sparklesIcon(16, 'grad-a')
    expect(svg).toContain('<svg width="16" height="16"')
  })

  it('defines the gradient under the given id and fills with it', () => {
    const svg = sparklesIcon(20, 'mcs-grad-test')
    expect(svg).toContain('<linearGradient id="mcs-grad-test"')
    expect(svg).toContain('fill="url(#mcs-grad-test)"')
  })

  it('uses the brand gradient stops', () => {
    const svg = sparklesIcon(16, 'g')
    expect(svg).toContain('#dd0cff')
    expect(svg).toContain('#00c8ff')
  })
})
