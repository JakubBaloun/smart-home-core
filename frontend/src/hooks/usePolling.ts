import { useCallback, useEffect, useRef, useState } from 'react'

interface PollingState<T> {
  data: T | null
  error: Error | null
  loading: boolean
}

export function usePolling<T>(fetcher: () => Promise<T>, intervalMs: number, deps: unknown[] = []) {
  const [state, setState] = useState<PollingState<T>>({ data: null, error: null, loading: true })
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher
  const latestRequestId = useRef(0)

  const refresh = useCallback(async () => {
    const requestId = ++latestRequestId.current
    try {
      const data = await fetcherRef.current()
      // A background poll can still be in flight when a manual refresh() is
      // triggered (e.g. a device toggle). If the older request resolves
      // after the newer one, applying it would clobber fresh data with a
      // stale snapshot — so only the most recently *started* request may
      // write state, regardless of resolution order.
      if (requestId !== latestRequestId.current) return
      setState({ data, error: null, loading: false })
    } catch (err) {
      if (requestId !== latestRequestId.current) return
      setState((prev) => ({ ...prev, error: err as Error, loading: false }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setState((prev) => ({ ...prev, loading: true }))
    refresh()

    const id = setInterval(refresh, intervalMs)

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, refresh, ...deps])

  return { ...state, refresh }
}
