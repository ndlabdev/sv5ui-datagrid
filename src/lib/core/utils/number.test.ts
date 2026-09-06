import { describe, expect, it } from 'vitest'
import { numericOrNull } from './number.js'

describe('reading a number out of whatever a row holds', () => {
    it('takes the numbers', () => {
        expect(numericOrNull(42)).toBe(42)
        expect(numericOrNull(-0)).toBe(-0)
        expect(numericOrNull('21')).toBe(21)
        expect(numericOrNull(true)).toBe(1)
    })

    it('refuses what is not a number rather than passing NaN on', () => {
        expect(numericOrNull(null)).toBeNull()
        expect(numericOrNull(undefined)).toBeNull()
        expect(numericOrNull('')).toBeNull()
        expect(numericOrNull(NaN)).toBeNull()
        expect(numericOrNull('abc')).toBeNull()
        expect(numericOrNull({})).toBeNull()
        expect(numericOrNull(new Map())).toBeNull()
    })

    it('survives the values that make Number() throw', () => {
        expect(() => numericOrNull(Symbol('s'))).not.toThrow()
        expect(numericOrNull(Symbol('s'))).toBeNull()
    })

    it('survives an object whose own valueOf throws', () => {
        const hostile = {
            valueOf() {
                throw new Error('no')
            }
        }
        expect(() => numericOrNull(hostile)).not.toThrow()
        expect(numericOrNull(hostile)).toBeNull()
    })

    it('keeps Infinity, which is a number a sum can carry', () => {
        expect(numericOrNull(Infinity)).toBe(Infinity)
    })
})

describe('what is not a number', () => {
    it('refuses whitespace, which Number() would call zero', () => {
        expect(numericOrNull(' ')).toBeNull()
        expect(numericOrNull('\t\n')).toBeNull()
    })

    it('refuses an array or an object, which Number() would also call zero', () => {
        expect(numericOrNull([])).toBeNull()
        expect(numericOrNull([5])).toBeNull()
        expect(numericOrNull({})).toBeNull()
    })

    it('still reads a Date as its instant', () => {
        expect(numericOrNull(new Date('2026-01-01T00:00:00.000Z'))).toBe(1767225600000)
    })
})
