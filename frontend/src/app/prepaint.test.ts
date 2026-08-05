/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const HTML_PATH = resolve(import.meta.dirname, '../../index.html')

/**
 * Extracts the body of the inline pre-paint `<script>` in `index.html` (the
 * first `<script>` tag, before the `type="module"` app entrypoint) so it can
 * be exercised directly, without booting Vite or a browser.
 */
function extractPrepaintScript(html: string): string {
  const match = html.match(/<script>([\s\S]*?)<\/script>/)
  if (!match) {
    throw new Error('pre-paint <script> not found in index.html')
  }
  return match[1]
}

/**
 * Runs the pre-paint script body inside a minimal sandbox and returns the
 * `data-theme` it resolved, mirroring how the real script runs against
 * `document`, `localStorage` and `matchMedia` as ambient globals.
 */
function runPrepaint(script: string, stored: string | null, prefersLight: boolean): string {
  const documentStub = {
    documentElement: { dataset: {} as Record<string, string> },
  }
  const localStorageStub = {
    getItem: () => stored,
  }
  const matchMediaStub = (query: string) => ({
    matches: query === '(prefers-color-scheme: light)' ? prefersLight : false,
  })

  const run = new Function('document', 'localStorage', 'matchMedia', script)
  run(documentStub, localStorageStub, matchMediaStub)

  return documentStub.documentElement.dataset.theme
}

describe('pre-paint theme script (index.html)', () => {
  const html = readFileSync(HTML_PATH, 'utf-8')
  const script = extractPrepaintScript(html)

  it('falls back to graphite with no stored value and no light preference', () => {
    expect(runPrepaint(script, null, false)).toBe('graphite')
  })

  it('falls back to light with no stored value and a light preference', () => {
    expect(runPrepaint(script, null, true)).toBe('light')
  })

  it('migrates the legacy "dark" value to graphite', () => {
    expect(runPrepaint(script, 'dark', false)).toBe('graphite')
  })

  it('keeps a known stored theme (graphite)', () => {
    expect(runPrepaint(script, 'graphite', false)).toBe('graphite')
  })

  it('keeps a known stored theme (obsidian-aurora)', () => {
    expect(runPrepaint(script, 'obsidian-aurora', false)).toBe('obsidian-aurora')
  })

  it('falls back to graphite for an unknown stored value with a dark preference', () => {
    expect(runPrepaint(script, 'nonsense', false)).toBe('graphite')
  })
})
