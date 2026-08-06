import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ColorWheel, positionToHueSaturation } from './ColorWheel'

describe('positionToHueSaturation', () => {
  const RADIUS = 100

  it('right of centre maps to hue 0, full saturation at the edge', () => {
    const { hue, saturation } = positionToHueSaturation(100, 0, RADIUS)
    expect(hue).toBe(0)
    expect(saturation).toBe(100)
  })

  it('below centre maps to hue 90', () => {
    const { hue } = positionToHueSaturation(0, 100, RADIUS)
    expect(hue).toBe(90)
  })

  it('left of centre maps to hue 180', () => {
    const { hue } = positionToHueSaturation(-100, 0, RADIUS)
    expect(hue).toBe(180)
  })

  it('above centre maps to hue 270', () => {
    const { hue } = positionToHueSaturation(0, -100, RADIUS)
    expect(hue).toBe(270)
  })

  it('centre maps to saturation 0', () => {
    const { saturation } = positionToHueSaturation(0, 0, RADIUS)
    expect(saturation).toBe(0)
  })

  it('half-radius maps to saturation 50', () => {
    const { saturation } = positionToHueSaturation(50, 0, RADIUS)
    expect(saturation).toBe(50)
  })

  it('clamps a pointer outside the circle to saturation 100', () => {
    const { hue, saturation } = positionToHueSaturation(200, 0, RADIUS)
    expect(hue).toBe(0)
    expect(saturation).toBe(100)
  })

  it('clamps an outside diagonal pointer to saturation 100 while preserving hue', () => {
    const { hue, saturation } = positionToHueSaturation(200, 200, RADIUS)
    expect(hue).toBe(45)
    expect(saturation).toBe(100)
  })

  it('normalises negative angles into 0-360', () => {
    const { hue } = positionToHueSaturation(1, -1, RADIUS)
    expect(hue).toBeGreaterThanOrEqual(0)
    expect(hue).toBeLessThan(360)
    expect(hue).toBe(315)
  })
})

describe('ColorWheel', () => {
  it('renders an accessible role="slider" wheel with the current values', () => {
    render(<ColorWheel hue={200} saturation={80} onCommit={vi.fn()} />)
    const wheel = screen.getByRole('slider', { name: /barva/i })
    expect(wheel).toHaveAttribute('aria-valuenow', '200')
    expect(wheel).toHaveAttribute('aria-valuemin', '0')
    expect(wheel).toHaveAttribute('aria-valuemax', '360')
  })

  it('marks itself aria-disabled when disabled', () => {
    render(<ColorWheel hue={0} saturation={0} disabled onCommit={vi.fn()} />)
    expect(screen.getByRole('slider', { name: /barva/i })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })
})
