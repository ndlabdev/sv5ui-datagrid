import { describe, expect, it } from 'vitest'
import {
    clampToMax,
    formatCurrency,
    formatDate,
    formatNumber,
    formatPercent,
    isBlank,
    toDate,
    toNumber
} from './format.js'

describe('coercion', () => {
    it('reads numbers from numbers and numeric strings', () => {
        expect(toNumber(42)).toBe(42)
        expect(toNumber('42.5')).toBe(42.5)
    })

    it.each([null, undefined, '', '  ', 'abc', NaN, Infinity, {}])(
        'refuses %p rather than producing NaN',
        (value) => {
            expect(toNumber(value)).toBeNull()
        }
    )

    it('reads dates from Date, ISO strings and epoch numbers', () => {
        const iso = '2026-03-14T10:30:00.000Z'
        expect(toDate(new Date(iso))?.toISOString()).toBe(iso)
        expect(toDate(iso)?.toISOString()).toBe(iso)
        expect(toDate(Date.parse(iso))?.toISOString()).toBe(iso)
    })

    it('reads a plain date as the day it spells, not as UTC midnight', () => {
        // Wherever the clock is behind Greenwich, `new Date('2026-03-14')`
        // lands on the 13th, and the cell drew a day the value does not say.
        const date = toDate('2026-03-14')!
        expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 2, 14])
        expect(formatDate('2026-03-14', { locale: 'en-US' })).toBe('Mar 14, 2026')
    })

    it('keeps a year under a hundred out of the 1900s', () => {
        // `new Date(y, m, d)` reads 0-99 as 1900 + y. A date field reporting a
        // year mid-keystroke says 2 before it says 2026, and the field was
        // handed 1902 back and jumped to it.
        const date = toDate('0002-01-05')!
        expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2, 0, 5])
        expect(toDate('0099-12-31')?.getFullYear()).toBe(99)
        expect(toDate('0100-01-01')?.getFullYear()).toBe(100)
    })

    it('refuses a plain date whose components cannot mean a day', () => {
        expect(toDate('2026-02-30')).toBeNull()
        expect(toDate('2026-13-01')).toBeNull()
    })

    it.each([null, undefined, 'not a date', new Date('nope')])(
        'refuses %p rather than rendering Invalid Date',
        (value) => {
            expect(toDate(value)).toBeNull()
        }
    )

    it('treats only null, undefined and empty string as blank', () => {
        expect([null, undefined, ''].every(isBlank)).toBe(true)
        expect([0, false, 'x', NaN].some(isBlank)).toBe(false)
    })
})

describe('formatting', () => {
    it('formats numbers with grouping for the given locale', () => {
        expect(formatNumber(1234567.891, { locale: 'en-US' })).toBe('1,234,567.891')
        expect(formatNumber(1234.5, { locale: 'de-DE' })).toBe('1.234,5')
    })

    it('honours explicit Intl options', () => {
        expect(
            formatNumber(1.23456, { locale: 'en-US', numberFormat: { maximumFractionDigits: 2 } })
        ).toBe('1.23')
    })

    it('formats currency and lets the code be overridden', () => {
        expect(formatCurrency(1234.5, { locale: 'en-US' })).toBe('$1,234.50')
        expect(formatCurrency(1234.5, { locale: 'en-US', currency: 'EUR' })).toBe('€1,234.50')
    })

    it('treats percent input as a ratio by default', () => {
        expect(formatPercent(0.42, { locale: 'en-US' })).toBe('42%')
    })

    it('accepts whole percents when told to', () => {
        expect(formatPercent(42, { locale: 'en-US', wholePercent: true })).toBe('42%')
    })

    it('formats dates and datetimes', () => {
        const value = new Date('2026-03-14T10:30:00Z')
        const options = { locale: 'en-US', dateFormat: { timeZone: 'UTC' } as const }
        expect(formatDate(value, options)).toBe('Mar 14, 2026')
        expect(formatDate(value, options, true)).toBe('Mar 14, 2026, 10:30 AM')
    })

    it('returns an empty string rather than NaN or Invalid Date', () => {
        expect(formatNumber('abc')).toBe('')
        expect(formatCurrency(null)).toBe('')
        expect(formatPercent(undefined)).toBe('')
        expect(formatDate('nonsense')).toBe('')
    })
})

describe('clampToMax', () => {
    it('keeps a value inside 0..max', () => {
        expect(clampToMax(50, 100)).toBe(50)
        expect(clampToMax(150, 100)).toBe(100)
        expect(clampToMax(-10, 100)).toBe(0)
    })

    it('treats unreadable values as zero', () => {
        expect(clampToMax('abc', 5)).toBe(0)
        expect(clampToMax(null, 5)).toBe(0)
    })
})
