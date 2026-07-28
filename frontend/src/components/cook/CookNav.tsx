import { Link } from 'react-router-dom'

export function CookNav({
  canGoBack,
  canGoForward,
  isLastStep,
  onBack,
  onForward,
}: {
  canGoBack: boolean
  canGoForward: boolean
  isLastStep: boolean
  onBack: () => void
  onForward: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <Link
        to="/cook"
        className="rounded-xl bg-gray-800 px-6 py-4 text-lg text-gray-300 transition hover:bg-gray-700"
      >
        ← Recipe list
      </Link>

      <div className="flex gap-4">
        <button
          type="button"
          disabled={!canGoBack}
          onClick={onBack}
          className="rounded-xl bg-gray-800 px-8 py-4 text-lg font-medium text-gray-100 transition hover:bg-gray-700 disabled:opacity-30"
        >
          Back
        </button>
        {canGoForward && (
          <button
            type="button"
            onClick={onForward}
            className="rounded-xl bg-emerald-700 px-8 py-4 text-lg font-medium text-white transition hover:bg-emerald-600"
          >
            {isLastStep ? 'Finish' : 'Next'}
          </button>
        )}
      </div>
    </div>
  )
}
