import { describe, expect, it } from 'vitest'
import { csvCell, labelledCsv, toCsv } from './csv'

describe('csvCell', () => {
  it('leaves plain values alone', () => {
    expect(csvCell('Leeds')).toBe('Leeds')
    expect(csvCell(12.5)).toBe('12.5')
    expect(csvCell(-3)).toBe('-3')
    expect(csvCell(null)).toBe('')
  })

  it('quotes commas, quotes, line breaks and edge spaces', () => {
    expect(csvCell('Cable & Jointing, North')).toBe('"Cable & Jointing, North"')
    expect(csvCell('the "main" site')).toBe('"the ""main"" site"')
    expect(csvCell('line one\nline two')).toBe('"line one\nline two"')
    expect(csvCell(' padded ')).toBe('" padded "')
  })

  it('stops a spreadsheet running text as a formula, but not plain negative numbers', () => {
    expect(csvCell('=SUM(A1:A9)')).toBe("'=SUM(A1:A9)")
    expect(csvCell('+44 7700 900000')).toBe("'+44 7700 900000")
    expect(csvCell('@risk')).toBe("'@risk")
    expect(csvCell('-cmd')).toBe("'-cmd")
    expect(csvCell('-12.5')).toBe('-12.5')
    expect(csvCell('=1,2')).toBe(`"'=1,2"`)
  })

  it('rejects numbers a spreadsheet cannot hold', () => {
    expect(() => csvCell(Number.NaN)).toThrow(RangeError)
    expect(() => csvCell(Infinity)).toThrow(RangeError)
  })
})

describe('toCsv and labelledCsv', () => {
  it('ends every row with CRLF', () => {
    expect(
      toCsv([
        ['a', 1],
        ['b', null],
      ]),
    ).toBe('a,1\r\nb,\r\n')
    expect(toCsv([])).toBe('')
  })

  it('opens with the synthetic-data label, the title, the date and the notice', () => {
    const csv = labelledCsv(toCsv([['ID'], ['RSP-001']]), {
      title: 'Responder compliance',
      asOf: Date.UTC(2026, 9, 14, 8),
      notice: 'All data is illustrative.',
    })
    expect(csv.split('\r\n')).toEqual([
      'Synthetic data: Responder compliance as at 14 Oct 2026',
      'All data is illustrative.',
      '',
      'ID',
      'RSP-001',
      '',
    ])
  })
})
