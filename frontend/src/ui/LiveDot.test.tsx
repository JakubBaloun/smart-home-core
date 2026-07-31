import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LiveDot } from './LiveDot'

describe('LiveDot', () => {
  it('renders a pulsing ok dot when online', () => {
    const { container } = render(<LiveDot online />)
    const dot = container.firstChild as HTMLElement

    expect(dot).toHaveClass('bg-ok')
    expect(dot).toHaveClass('animate-breathe')
  })

  it('renders a static faint dot when offline', () => {
    const { container } = render(<LiveDot online={false} />)
    const dot = container.firstChild as HTMLElement

    expect(dot).toHaveClass('bg-ink-faint')
    expect(dot).not.toHaveClass('animate-breathe')
  })
})
