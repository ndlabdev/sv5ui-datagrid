import { describe, expect, it } from 'vitest'
import { applyMask, maskEmail, maskInitials, maskLast4, REDACTED } from './masks.js'

describe('the built-in masks', () => {
    it('keeps the last four, which is what a receipt shows', () => {
        expect(maskLast4('0123456789')).toBe(`${REDACTED}6789`)
        expect(maskLast4(1234567)).toBe(`${REDACTED}4567`)
    })

    it('refuses to keep four of a value that is barely four', () => {
        expect(maskLast4('123')).toBe(REDACTED)
        expect(maskLast4('1234')).toBe(REDACTED)
    })

    it('leaves an email addressable without giving the person away', () => {
        expect(maskEmail('chi.nguyen@example.vn')).toBe(`c${REDACTED}@example.vn`)
        expect(maskEmail('not-an-email')).toBe(REDACTED)
        expect(maskEmail('@nolocal.vn')).toBe(REDACTED)
    })

    it('reduces a name to initials, diacritics kept whole', () => {
        expect(maskInitials('Nguyễn Thị Chi')).toBe('N. T. C.')
        expect(maskInitials('  ')).toBe(REDACTED)
    })

    it('hides by returning null, so a number column draws nothing rather than zero', () => {
        expect(applyMask('hide', 120_000)).toBeNull()
        expect(applyMask('hide', null)).toBeNull()
    })

    it('leaves a blank blank rather than redacting emptiness', () => {
        expect(applyMask('redact', '')).toBe('')
        expect(applyMask('last4', null)).toBeNull()
        expect(applyMask('email', undefined)).toBeUndefined()
    })

    it('redacts everything else to one fixed shape, so length says nothing', () => {
        expect(applyMask('redact', 'short')).toBe(REDACTED)
        expect(applyMask('redact', 'a much longer secret')).toBe(REDACTED)
    })
})
