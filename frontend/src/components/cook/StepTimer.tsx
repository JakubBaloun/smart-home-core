import { useEffect, useRef } from 'react'
import { useCountdownTimer } from '../../hooks/useCountdownTimer'

function playBeep() {
  const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextClass) return

  const context = new AudioContextClass()
  const oscillator = context.createOscillator()
  oscillator.type = 'sine'
  oscillator.frequency.value = 880
  oscillator.connect(context.destination)
  oscillator.start()
  oscillator.stop(context.currentTime + 0.6)
  oscillator.onended = () => context.close()
}

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function StepTimer({ seconds }: { seconds: number }) {
  const completedRef = useRef(false)
  const { remaining, running, start, pause, reset } = useCountdownTimer(seconds, () => {
    completedRef.current = true
    playBeep()
  })

  useEffect(() => {
    completedRef.current = false
  }, [seconds])

  const justCompleted = completedRef.current && remaining === 0

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className={`text-6xl font-mono font-bold ${justCompleted ? 'animate-pulse text-emerald-400' : 'text-gray-100'}`}
      >
        {formatClock(remaining)}
      </div>
      <div className="flex gap-4">
        {running ? (
          <button
            type="button"
            onClick={pause}
            className="rounded-xl bg-gray-800 px-6 py-3 text-lg font-medium text-gray-100 transition hover:bg-gray-700"
          >
            Pause
          </button>
        ) : (
          <button
            type="button"
            onClick={start}
            className="rounded-xl bg-purple-700 px-6 py-3 text-lg font-medium text-white transition hover:bg-purple-600"
          >
            Start
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            completedRef.current = false
            reset()
          }}
          className="rounded-xl bg-gray-800 px-6 py-3 text-lg font-medium text-gray-100 transition hover:bg-gray-700"
        >
          Reset
        </button>
      </div>
    </div>
  )
}
