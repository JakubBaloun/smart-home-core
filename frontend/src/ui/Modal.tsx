import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

/** Generic centered dialog, portaled to `document.body`. Not specific to any feature. */
export function Modal({ open, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (!open) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'color-mix(in srgb, var(--ink) 40%, transparent)' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        className="animate-fade-slide-in w-full max-w-md rounded-2xl border border-line bg-surface-raised p-5 shadow-lg"
      >
        <div className="flex items-center justify-between gap-2">
          {title && <h2 className="text-lg font-semibold text-ink">{title}</h2>}
          <button
            type="button"
            aria-label="Zavřít"
            onClick={onClose}
            className="-m-2 ml-auto flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full p-2 text-ink-muted hover:text-ink"
          >
            <span aria-hidden="true" className="text-xl leading-none">
              &times;
            </span>
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
