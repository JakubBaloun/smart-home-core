import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Modal } from './Modal'

describe('Modal', () => {
  it('renders children when open', () => {
    render(
      <Modal open onClose={vi.fn()} title="Test">
        <p>Modal body</p>
      </Modal>,
    )

    expect(screen.getByText('Modal body')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('renders nothing when closed', () => {
    render(
      <Modal open={false} onClose={vi.fn()}>
        <p>Modal body</p>
      </Modal>,
    )

    expect(screen.queryByText('Modal body')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('calls onClose on Escape', () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose}>
        <p>Modal body</p>
      </Modal>,
    )

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose on backdrop click but not on a click inside the panel', () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="Test">
        <p>Modal body</p>
      </Modal>,
    )

    fireEvent.click(screen.getByText('Modal body'))
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('dialog').parentElement as HTMLElement)
    expect(onClose).toHaveBeenCalled()
  })
})
