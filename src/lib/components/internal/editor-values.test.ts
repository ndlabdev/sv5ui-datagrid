import { parseDate } from '@internationalized/date'
import { describe, expect, it } from 'vitest'
import { fromDateValue, fromTimeValue, toDateValue, toTimeValue } from './editor-values.js'

describe('toDateValue', () => {
    it('reads what a cell holds, whichever way it holds it', () => {
        expect(toDateValue('2026-01-05')?.toString()).toBe('2026-01-05')
        expect(toDateValue(new Date(2026, 0, 5))?.toString()).toBe('2026-01-05')
        expect(toDateValue('')).toBeUndefined()
        expect(toDateValue(null)).toBeUndefined()
        expect(toDateValue('nonsense')).toBeUndefined()
    })
})

describe('fromDateValue', () => {
    it('writes ISO, four digits of year', () => {
        expect(fromDateValue({ year: 2026, month: 1, day: 5 })).toBe('2026-01-05')
        expect(fromDateValue(undefined)).toBe('')
    })

    /**
     * A segmented field reports every keystroke, so a year on its way to 2026
     * arrives as 2, then 20, then 202. Unpadded, those wrote `2-01-05` into a
     * cell and into a filter: not a date any parser here reads back, and not
     * one a server would either.
     */
    it('pads a year still being typed rather than writing a broken date', () => {
        for (const year of [2, 20, 202, 2026]) {
            const written = fromDateValue({ year, month: 1, day: 5 })
            expect(written).toMatch(/^\d{4}-\d{2}-\d{2}$/)
            expect(parseDate(written).year).toBe(year)
            // And back again, which is what a controlled picker does on every
            // keystroke: it has to land on the same date it just reported.
            expect(toDateValue(written)?.toString()).toBe(written)
        }
    })
})

describe('time values', () => {
    it('round-trips what a time editor holds', () => {
        expect(toTimeValue('09:30')?.toString()).toContain('09:30')
        expect(toTimeValue('')).toBeUndefined()
        expect(fromTimeValue({ hour: 9, minute: 5 })).toBe('09:05')
        expect(fromTimeValue(undefined)).toBe('')
    })
})
