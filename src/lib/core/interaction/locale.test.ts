import { describe, expect, it } from 'vitest'
import type { DataGridLocalePack } from '../types/index.js'
import { resolveLocale } from './locale.js'

const pack = (tag: string) => ({ tag }) as DataGridLocalePack

describe('resolveLocale', () => {
    const packs = [pack('en-US'), pack('vi-VN'), pack('fr-FR')]

    it('takes the exact tag when one answers for it', () => {
        expect(resolveLocale(packs, 'vi-VN')?.tag).toBe('vi-VN')
    })

    it('accepts a language without its region, and a region nobody ships', () => {
        // A grid in roughly the right language beats one in the wrong one.
        expect(resolveLocale(packs, 'vi')?.tag).toBe('vi-VN')
        expect(resolveLocale(packs, 'en-GB')?.tag).toBe('en-US')
    })

    it('falls through rather than guessing at an unrelated tag', () => {
        // English is the built-in fallback; a missing translation is not a
        // reason to render in a language nobody asked for.
        expect(resolveLocale(packs, 'ja-JP')).toBeUndefined()
        expect(resolveLocale([], 'vi-VN')).toBeUndefined()
    })
})
