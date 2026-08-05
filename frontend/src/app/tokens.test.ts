/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { THEMES } from './theme'

const CSS_PATH = resolve(import.meta.dirname, '../index.css')

const REQUIRED_TOKENS = [
  'surface-sunken',
  'surface',
  'surface-raised',
  'overlay',
  'line',
  'line-strong',
  'ink',
  'ink-muted',
  'ink-faint',
  'accent',
  'accent-strong',
  'accent-ink',
  'ok',
  'cool',
  'warm',
  'danger',
  'extreme',
]

function extractThemeBlocks(css: string): Map<string, string> {
  const blocks = new Map<string, string>()
  const selectorRegex = /\[data-theme='([^']+)'\]\s*\{/g
  let match: RegExpExecArray | null

  while ((match = selectorRegex.exec(css)) !== null) {
    const id = match[1]
    const bodyStart = match.index + match[0].length
    let depth = 1
    let i = bodyStart
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth++
      if (css[i] === '}') depth--
      i++
    }
    blocks.set(id, css.slice(bodyStart, i - 1))
  }

  return blocks
}

describe('theme tokens in index.css', () => {
  const css = readFileSync(CSS_PATH, 'utf-8')
  const blocks = extractThemeBlocks(css)
  const themeIds = THEMES.map((t) => t.id)

  it('declares a [data-theme] block for every id in THEMES, and no extras', () => {
    expect(new Set(blocks.keys())).toEqual(new Set(themeIds))
  })

  it.each(themeIds)('%s declares all 17 required tokens', (id) => {
    const block = blocks.get(id)
    expect(block).toBeDefined()

    for (const token of REQUIRED_TOKENS) {
      const tokenRegex = new RegExp(`--${token}:`)
      expect(block).toMatch(tokenRegex)
    }
  })
})
