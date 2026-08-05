import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RoomWidget } from './RoomWidget'

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 })
}

describe('RoomWidget', () => {
  it('shows only the current value for a metric widget when showGraph is false', () => {
    render(
      <RoomWidget
        kind="metric"
        field="temperature"
        deviceKey="0xabc"
        label="Office temp"
        range="24h"
        showGraph={false}
        value={21.5}
      />,
    )

    expect(screen.getByText('Office temp')).toBeInTheDocument()
    expect(screen.getByText('21.5°C')).toBeInTheDocument()
  })

  it('renders the field chart for a metric widget when showGraph is true', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ deviceName: 'x', field: 'temperature', points: [] })))

    render(
      <RoomWidget
        kind="metric"
        field="temperature"
        deviceKey="0xabc"
        label="Office temp"
        range="24h"
        showGraph={true}
        value={21.5}
      />,
    )

    expect(await screen.findByText('temperature')).toBeInTheDocument()

    vi.unstubAllGlobals()
  })

  it('shows a closed/open badge for a contact widget when showGraph is false', () => {
    render(
      <RoomWidget kind="contact" deviceKey="0xabc" label="Office door" range="24h" showGraph={false} value={1} />,
    )

    expect(screen.getByText('Office door')).toBeInTheDocument()
    expect(screen.getByText('zavřeno')).toBeInTheDocument()
  })

  it('renders a toggle for a state widget and calls onToggle when clicked', async () => {
    const onToggle = vi.fn()
    render(<RoomWidget kind="state" label="Office lamp" value="OFF" onToggle={onToggle} toggling={false} />)

    expect(screen.getByText('Office lamp')).toBeInTheDocument()
    const button = screen.getByText('Vypnuto')

    await userEvent.click(button)

    expect(onToggle).toHaveBeenCalledOnce()
  })

  it('shows Zapnuto and disables the button while toggling a state widget', () => {
    render(<RoomWidget kind="state" label="Office lamp" value="ON" onToggle={() => {}} toggling={true} />)

    const button = screen.getByText('Zapnuto')
    expect(button).toBeDisabled()
  })
})
