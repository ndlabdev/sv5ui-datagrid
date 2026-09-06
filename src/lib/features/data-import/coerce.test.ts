import { describe, expect, it } from 'vitest'
import { coerce, parseBoolean, parseDate, parseNumber } from './coerce.js'

describe('reading a number a spreadsheet wrote', () => {
    it.each([
        ['1234', 1234],
        ['1,234', 1234],
        ['1.234,50', 1234.5],
        ['1,234.50', 1234.5],
        ['1 234,5', 1234.5],
        ['-12.5', -12.5],
        ['0,5', 0.5],
        ['12%', 0.12],
        ['$1,299.00', 1299],
        ['1.234.567', 1234567]
    ])('reads %s as %s', (text, expected) => {
        expect(parseNumber(text)).toBe(expected)
    })

    it.each(['', '   ', 'abc', '--', '+', '.', 'Infinity', '1e999'])('refuses %s', (text) => {
        expect(parseNumber(text)).toBeNull()
    })

    it('reads the parentheses a finance export writes a negative with', () => {
        expect(parseNumber('(1,234.50)')).toBe(-1234.5)
        expect(parseNumber('(12%)')).toBe(-0.12)
        expect(parseNumber('(0)')).toBe(-0)
    })

    it('takes the mark an app names rather than guessing', () => {
        expect(parseNumber('1.250', ',')).toBe(1250)
        expect(parseNumber('1.250', '.')).toBe(1.25)
        expect(parseNumber('1.250,50', ',')).toBe(1250.5)
    })
})

describe('reading a date a spreadsheet wrote', () => {
    it('reads an ISO date as the day it spells', () => {
        const parsed = parseDate('2026-03-02')!
        expect([parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate()]).toEqual([
            2026, 3, 2
        ])
    })

    it('keeps the time an ISO datetime carries', () => {
        const parsed = parseDate('2026-03-02T10:30')!
        expect([parsed.getHours(), parsed.getMinutes()]).toEqual([10, 30])
    })

    it('reads a day-first date, which is what most of the world writes', () => {
        const parsed = parseDate('25/12/2026')!
        expect([parsed.getMonth() + 1, parsed.getDate()]).toEqual([12, 25])
    })

    it('reads a month-first date when the first number cannot be a day', () => {
        const parsed = parseDate('12/25/2026')!
        expect([parsed.getMonth() + 1, parsed.getDate()]).toEqual([12, 25])
    })

    it('refuses a date that does not exist', () => {
        expect(parseDate('31/02/2026')).toBeNull()
    })

    it('refuses an ISO date that does not exist rather than rolling it over', () => {
        expect(parseDate('2026-13-45')).toBeNull()
        expect(parseDate('2026-00-10')).toBeNull()
        expect(parseDate('2026-02-30')).toBeNull()
        expect(parseDate('2026-02-28')).not.toBeNull()
    })

    it('honours a timezone the text carries rather than reading it as local', () => {
        const zoned = parseDate('2026-03-02T10:00:00Z')!
        expect(zoned.toISOString()).toBe('2026-03-02T10:00:00.000Z')
        expect(parseDate('2026-03-02T10:00:00+02:00')!.toISOString()).toBe(
            '2026-03-02T08:00:00.000Z'
        )
    })

    it('reads a two-digit year the same way round as a four-digit one', () => {
        const short = parseDate('03/04/26')!
        const long = parseDate('03/04/2026')!
        expect([short.getFullYear(), short.getMonth(), short.getDate()]).toEqual([2026, 3, 3])
        expect([short.getFullYear(), short.getMonth(), short.getDate()]).toEqual([
            long.getFullYear(),
            long.getMonth(),
            long.getDate()
        ])
    })

    it('puts a two-digit year in the century a spreadsheet means', () => {
        expect(parseDate('01/01/69')!.getFullYear()).toBe(2069)
        expect(parseDate('01/01/70')!.getFullYear()).toBe(1970)
    })

    it('refuses a year that cannot be written as one', () => {
        expect(parseDate('0000-01-01')).toBeNull()
    })

    it.each(['', 'soon', '99'])('refuses %s', (text) => {
        expect(parseDate(text)).toBeNull()
    })
})

describe('reading a yes or a no', () => {
    it.each(['true', 'YES', 'y', '1', 'x', 'Có'])('reads %s as true', (text) => {
        expect(parseBoolean(text)).toBe(true)
    })

    it.each(['false', 'no', 'n', '0', 'Không'])('reads %s as false', (text) => {
        expect(parseBoolean(text)).toBe(false)
    })

    it('refuses a word it does not know rather than guessing', () => {
        expect(parseBoolean('maybe')).toBeNull()
    })
})

describe('coercing a cell into what a column holds', () => {
    it('leaves a blank blank without calling it a problem', () => {
        expect(coerce('', 'number')).toEqual({ value: null, problem: null })
        expect(coerce(null, 'date')).toEqual({ value: null, problem: null })
    })

    it('names the kind of value it could not read', () => {
        expect(coerce('abc', 'number').problem).toBe('number')
        expect(coerce('soon', 'date').problem).toBe('date')
        expect(coerce('maybe', 'boolean').problem).toBe('boolean')
    })

    it('takes a number that arrived as a number, from xlsx', () => {
        expect(coerce(1234.5, 'number')).toEqual({ value: 1234.5, problem: null })
    })

    it('takes a date that arrived as a Date, from xlsx', () => {
        const date = new Date(2026, 2, 2)
        expect(coerce(date, 'date')).toEqual({ value: date, problem: null })
    })

    it('writes a date into a text column as the day, not as an instant', () => {
        expect(coerce(new Date(Date.UTC(2026, 2, 2)), 'text').value).toBe('2026-03-02')
    })

    it('leaves a formula-looking cell as the text it is', () => {
        expect(coerce('=SUM(A1:A9)', 'text')).toEqual({ value: '=SUM(A1:A9)', problem: null })
    })
})
