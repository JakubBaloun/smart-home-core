import { useEffect, useRef } from 'react'
import { Button } from '@/ui/Button'
import { Ring } from '@/ui/Ring'
import { useCountdownTimer } from '../hooks/useCountdownTimer'

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
    <div className="flex flex-col items-center gap-6">
      <div
        className={`relative flex items-center justify-center ${
          justCompleted ? 'animate-pulse text-ok' : 'text-accent'
        }`}
      >
        <Ring size={210} strokeWidth={2.5} progress={seconds > 0 ? remaining / seconds : 0} />
        <span className="absolute font-mono text-5xl font-semibold text-ink tabular-nums">
          {formatClock(remaining)}
        </span>
      </div>
      <div className="flex gap-4">
        {running ? (
          <Button variant="neutral" size="lg" onClick={pause} className="min-w-28">
            Pause
          </Button>
        ) : (
          <Button variant="primary" size="lg" onClick={start} className="min-w-28">
            Start
          </Button>
        )}
        <Button
          variant="neutral"
          size="lg"
          onClick={() => {
            completedRef.current = false
            reset()
          }}
        >
          Reset
        </Button>
      </div>
    </div>
  )
}
