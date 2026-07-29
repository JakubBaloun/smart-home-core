import { useCallback, useEffect, useRef, useState } from 'react'

export function useCountdownTimer(initialSeconds: number, onComplete?: () => void) {
  const [remaining, setRemaining] = useState(initialSeconds)
  const [running, setRunning] = useState(false)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useEffect(() => {
    if (!running) return

    const id = setInterval(() => {
      setRemaining((prev) => {
        // The interval keeps firing until this effect's cleanup runs on the next
        // render, so once we hit zero, further ticks must be no-ops rather than
        // re-triggering onComplete.
        if (prev <= 0) return prev
        if (prev === 1) {
          setRunning(false)
          onCompleteRef.current?.()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(id)
  }, [running])

  const start = useCallback(() => {
    setRemaining((prev) => (prev <= 0 ? initialSeconds : prev))
    setRunning(true)
  }, [initialSeconds])

  const pause = useCallback(() => setRunning(false), [])

  const reset = useCallback(() => {
    setRunning(false)
    setRemaining(initialSeconds)
  }, [initialSeconds])

  return { remaining, running, start, pause, reset }
}
