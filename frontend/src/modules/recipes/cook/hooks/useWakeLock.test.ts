import { render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useWakeLock } from './useWakeLock'

function TestComponent({ active }: { active: boolean }) {
  useWakeLock(active)
  return null
}

describe('useWakeLock', () => {
  let release: ReturnType<typeof vi.fn>
  let request: ReturnType<typeof vi.fn>

  beforeEach(() => {
    release = vi.fn().mockResolvedValue(undefined)
    request = vi.fn().mockResolvedValue({ release })
    vi.stubGlobal('navigator', { ...navigator, wakeLock: { request } })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('requests a screen wake lock on mount when active', async () => {
    render(createElement(TestComponent, { active: true }))

    await vi.waitFor(() => expect(request).toHaveBeenCalledWith('screen'))
  })

  it('does not request a wake lock when inactive', async () => {
    render(createElement(TestComponent, { active: false }))

    await Promise.resolve()
    expect(request).not.toHaveBeenCalled()
  })

  it('releases the sentinel on unmount', async () => {
    const { unmount } = render(createElement(TestComponent, { active: true }))

    await vi.waitFor(() => expect(request).toHaveBeenCalled())
    unmount()

    expect(release).toHaveBeenCalled()
  })

  it('re-requests the wake lock when visibility returns', async () => {
    render(createElement(TestComponent, { active: true }))

    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1))

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2))
  })
})
