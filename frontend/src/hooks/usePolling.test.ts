import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { usePolling } from './usePolling'

describe('usePolling', () => {
  it('ignores a stale response that resolves after a newer request', async () => {
    // Simulates a background poll (started first, slow) racing a manual
    // refresh() call (started second, fast) — as happens when a user
    // toggles a device while the interval poll is still in flight.
    let resolveFirst!: (value: string) => void
    let resolveSecond!: (value: string) => void
    let call = 0
    const fetcher = vi.fn(() => {
      call += 1
      if (call === 1) return new Promise<string>((resolve) => (resolveFirst = resolve))
      return new Promise<string>((resolve) => (resolveSecond = resolve))
    })

    const { result } = renderHook(() => usePolling(fetcher, 15_000))

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))

    let secondCall!: Promise<void>
    act(() => {
      secondCall = result.current.refresh()
    })
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))

    // Second (newer) request resolves first, with fresh data.
    await act(async () => {
      resolveSecond('fresh')
      await secondCall
    })
    expect(result.current.data).toBe('fresh')

    // First (older, stale) request resolves after — must not overwrite.
    await act(async () => {
      resolveFirst('stale')
    })
    expect(result.current.data).toBe('fresh')
  })
})
