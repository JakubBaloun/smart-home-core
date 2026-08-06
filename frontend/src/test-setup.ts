import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

/*
 * Node ships an experimental global `localStorage` that shadows the jsdom one and
 * is unusable without --localstorage-file, so tests get an in-memory Storage instead.
 */
class MemoryStorage implements Storage {
  private entries = new Map<string, string>()

  get length(): number {
    return this.entries.size
  }

  key(index: number): string | null {
    return [...this.entries.keys()][index] ?? null
  }

  getItem(key: string): string | null {
    return this.entries.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.entries.set(key, String(value))
  }

  removeItem(key: string): void {
    this.entries.delete(key)
  }

  clear(): void {
    this.entries.clear()
  }
}

Object.defineProperty(globalThis, 'localStorage', {
  value: new MemoryStorage(),
  configurable: true,
  writable: true,
})

/*
 * jsdom has no ResizeObserver. react-grid-layout's WidthProvider uses one to track
 * container width, so components that render it (e.g. RoomOverviewPage's edit mode)
 * need at least a no-op stub to mount in tests.
 */
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

Object.defineProperty(globalThis, 'ResizeObserver', {
  value: ResizeObserverStub,
  configurable: true,
  writable: true,
})

/*
 * jsdom doesn't implement the Pointer Capture API (setPointerCapture/releasePointerCapture/
 * hasPointerCapture). ColorWheel calls setPointerCapture on pointerdown so a drag keeps
 * tracking even if the pointer leaves the wheel; without a stub, firing a pointerdown event
 * in tests throws "setPointerCapture is not a function".
 */
Object.defineProperty(Element.prototype, 'setPointerCapture', {
  value: function setPointerCapture() {},
  configurable: true,
  writable: true,
})

Object.defineProperty(Element.prototype, 'releasePointerCapture', {
  value: function releasePointerCapture() {},
  configurable: true,
  writable: true,
})

Object.defineProperty(Element.prototype, 'hasPointerCapture', {
  value: function hasPointerCapture() {
    return false
  },
  configurable: true,
  writable: true,
})
