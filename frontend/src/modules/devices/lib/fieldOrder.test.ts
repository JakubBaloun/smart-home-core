import { describe, expect, it } from 'vitest'
import { sortFieldsForDisplay } from './fieldOrder'

describe('sortFieldsForDisplay', () => {
  it('leaves non-diagnostic fields in their original order', () => {
    expect(sortFieldsForDisplay(['humidity', 'temperature', 'power'])).toEqual([
      'humidity',
      'temperature',
      'power',
    ])
  })

  it('moves battery and linkquality to the end, in their original relative order', () => {
    expect(sortFieldsForDisplay(['linkquality', 'temperature', 'battery', 'humidity'])).toEqual([
      'temperature',
      'humidity',
      'linkquality',
      'battery',
    ])
  })

  it('handles a list of only diagnostic fields', () => {
    expect(sortFieldsForDisplay(['battery', 'linkquality'])).toEqual(['battery', 'linkquality'])
  })

  it('handles an empty list', () => {
    expect(sortFieldsForDisplay([])).toEqual([])
  })
})
