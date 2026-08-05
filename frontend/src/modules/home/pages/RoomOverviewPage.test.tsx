import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RoomOverviewPage } from './RoomOverviewPage'

const DEVICES_PATH = '/api/devices'

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 })
}

describe('RoomOverviewPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders one card per configured room, including rooms without a sensor', async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url === DEVICES_PATH) return Promise.resolve(jsonResponse([]))
      return Promise.resolve(new Response('not found', { status: 404 }))
    })

    render(
      <MemoryRouter>
        <RoomOverviewPage />
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByText('Pracovna')).toBeInTheDocument())
    expect(screen.getByText('Ložnice')).toBeInTheDocument()
    expect(screen.getByText('Kuchyně')).toBeInTheDocument()
    expect(screen.getAllByText('bez senzoru').length).toBeGreaterThan(0)
  })

  it('shows an edit-mode toggle that switches to the draggable grid and back', async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url === DEVICES_PATH) return Promise.resolve(jsonResponse([]))
      return Promise.resolve(new Response('not found', { status: 404 }))
    })

    render(
      <MemoryRouter>
        <RoomOverviewPage />
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByText('Pracovna')).toBeInTheDocument())
    expect(screen.queryByText('Resetovat rozložení')).not.toBeInTheDocument()

    await userEvent.click(screen.getByText('Upravit rozložení'))

    expect(screen.getByText('Resetovat rozložení')).toBeInTheDocument()
    expect(screen.getByText('Hotovo')).toBeInTheDocument()

    await userEvent.click(screen.getByText('Hotovo'))

    expect(screen.queryByText('Resetovat rozložení')).not.toBeInTheDocument()
    expect(screen.getByText('Upravit rozložení')).toBeInTheDocument()
  })

  it('clears the saved layout when Resetovat rozložení is clicked', async () => {
    localStorage.setItem('home-room-layout', JSON.stringify({ lg: [{ i: 'office', x: 0, y: 0, w: 1, h: 1 }] }))
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url === DEVICES_PATH) return Promise.resolve(jsonResponse([]))
      return Promise.resolve(new Response('not found', { status: 404 }))
    })

    render(
      <MemoryRouter>
        <RoomOverviewPage />
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByText('Pracovna')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Upravit rozložení'))
    await userEvent.click(screen.getByText('Resetovat rozložení'))

    expect(localStorage.getItem('home-room-layout')).toBeNull()
  })
})
