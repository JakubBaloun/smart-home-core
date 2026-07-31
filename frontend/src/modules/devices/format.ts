export function formatLastSeen(lastSeen: string | null, noValueLabel = 'Never seen'): string {
  if (!lastSeen) return noValueLabel
  const diffMs = Date.now() - new Date(lastSeen).getTime()
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
