import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCountdownTimer } from './useCountdownTimer'

describe('useCountdownTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts at the initial seconds and does not count down until started', () => {
    const { result } = renderHook(() => useCountdownTimer(5))

    expect(result.current.remaining).toBe(5)
    expect(result.current.running).toBe(false)

    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(result.current.remaining).toBe(5)
  })

  it('decrements once per second while running', () => {
    const { result } = renderHook(() => useCountdownTimer(5))

    act(() => {
      result.current.start()
    })
    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(result.current.remaining).toBe(3)
  })

  it('fires onComplete exactly once when it reaches zero', () => {
    const onComplete = vi.fn()
    const { result } = renderHook(() => useCountdownTimer(2, onComplete))

    act(() => {
      result.current.start()
    })
    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(result.current.remaining).toBe(0)
    expect(result.current.running).toBe(false)
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('pause stops the countdown without resetting', () => {
    const { result } = renderHook(() => useCountdownTimer(5))

    act(() => {
      result.current.start()
    })
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    act(() => {
      result.current.pause()
    })
    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(result.current.remaining).toBe(3)
    expect(result.current.running).toBe(false)
  })

  it('reset returns to the initial seconds and stops running', () => {
    const { result } = renderHook(() => useCountdownTimer(5))

    act(() => {
      result.current.start()
    })
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    act(() => {
      result.current.reset()
    })

    expect(result.current.remaining).toBe(5)
    expect(result.current.running).toBe(false)
  })
})
