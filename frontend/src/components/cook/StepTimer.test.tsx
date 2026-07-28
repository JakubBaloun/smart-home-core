import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StepTimer } from './StepTimer'

class FakeOscillator {
  type = 'sine'
  frequency = { value: 0 }
  onended: (() => void) | null = null
  connect = vi.fn()
  start = vi.fn()
  stop = vi.fn()
}

class FakeAudioContext {
  currentTime = 0
  destination = {}
  createOscillator = vi.fn(() => new FakeOscillator())
  close = vi.fn()
}

describe('StepTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('AudioContext', FakeAudioContext)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('shows the initial time formatted as mm:ss', () => {
    render(<StepTimer seconds={125} />)

    expect(screen.getByText('02:05')).toBeInTheDocument()
  })

  it('counts down once started', () => {
    render(<StepTimer seconds={10} />)

    act(() => {
      screen.getByText('Start').click()
    })
    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(screen.getByText('00:07')).toBeInTheDocument()
  })

  it('reaches zero and plays a beep on completion', () => {
    render(<StepTimer seconds={2} />)

    act(() => {
      screen.getByText('Start').click()
    })
    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(screen.getByText('00:00')).toBeInTheDocument()
  })

  it('reset returns the display to the initial time', () => {
    render(<StepTimer seconds={10} />)

    act(() => {
      screen.getByText('Start').click()
    })
    act(() => {
      vi.advanceTimersByTime(4000)
    })
    act(() => {
      screen.getByText('Reset').click()
    })

    expect(screen.getByText('00:10')).toBeInTheDocument()
  })
})
