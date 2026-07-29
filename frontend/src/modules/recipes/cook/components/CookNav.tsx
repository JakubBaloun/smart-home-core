import { Button, ButtonLink } from '@/ui/Button'
import { IconChevronLeft } from '@/ui/icons'

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
      <ButtonLink to="/cook" variant="ghost" size="lg">
        <IconChevronLeft className="size-5" />
        Recipe list
      </ButtonLink>

      <div className="flex gap-4">
        <Button variant="neutral" size="lg" disabled={!canGoBack} onClick={onBack} className="min-w-32">
          Back
        </Button>
        {canGoForward && (
          <Button variant="primary" size="lg" onClick={onForward} className="min-w-32">
            {isLastStep ? 'Finish' : 'Next'}
          </Button>
        )}
      </div>
    </div>
  )
}
