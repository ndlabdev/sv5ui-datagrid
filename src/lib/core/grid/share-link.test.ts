import { SNAPSHOT_VERSION, type GridSnapshot } from '../types/index.js'
import { describe, expect, it } from 'vitest'
import {
    canonicalJson,
    decodeSnapshot,
    encodeSnapshot,
    sameSnapshot,
    SHARE_LIMIT,
    ShareTooLongError
} from './share-link.js'

const base: GridSnapshot = {
    version: SNAPSHOT_VERSION,
    density: 'compact',
    columns: { order: ['a', 'b'], hidden: { b: true } },
    features: { grouping: { by: ['dept'] } }
}

describe('canonicalJson', () => {
    it('reads two snapshots written in a different key order as the same', () => {
        const one = { version: 1, density: 'compact', columns: { order: ['a'] } } as GridSnapshot
        const two = { columns: { order: ['a'] }, density: 'compact', version: 1 } as GridSnapshot
        expect(canonicalJson(one)).toBe(canonicalJson(two))
        expect(sameSnapshot(one, two)).toBe(true)
    })

    it('keeps array order, which carries meaning', () => {
        const one = { version: 1, columns: { order: ['a', 'b'] } } as GridSnapshot
        const two = { version: 1, columns: { order: ['b', 'a'] } } as GridSnapshot
        expect(sameSnapshot(one, two)).toBe(false)
    })

    it('treats an absent key and an undefined one alike', () => {
        const one = { version: 1, density: undefined } as GridSnapshot
        expect(canonicalJson(one)).toBe(canonicalJson({ version: 1 }))
    })

    it('sees a difference nested inside a feature slice', () => {
        expect(sameSnapshot(base, { ...base, features: { grouping: { by: ['country'] } } })).toBe(
            false
        )
    })
})

describe('encodeSnapshot and decodeSnapshot', () => {
    it('round-trips', async () => {
        const token = await encodeSnapshot(base)
        await expect(decodeSnapshot(token)).resolves.toEqual(base)
    })

    it('produces a token safe to drop in a URL', async () => {
        const token = await encodeSnapshot(base)
        expect(token).toMatch(/^[01][A-Za-z0-9_-]*$/)
        expect(encodeURIComponent(token)).toBe(token)
    })

    it('compresses, so a repetitive state does not grow with its repetition', async () => {
        const wide: GridSnapshot = {
            version: SNAPSHOT_VERSION,
            columns: {
                hidden: Object.fromEntries(
                    Array.from({ length: 200 }, (_, i) => [`column_${i}`, true])
                )
            }
        }
        const token = await encodeSnapshot(wide)
        expect(token.length).toBeLessThan(canonicalJson(wide).length / 4)
        await expect(decodeSnapshot(token)).resolves.toEqual(wide)
    })

    it('refuses a state too big for a link instead of handing back a broken one', async () => {
        const huge: GridSnapshot = {
            version: SNAPSHOT_VERSION,
            columns: {
                widths: Object.fromEntries(
                    Array.from({ length: 40_000 }, (_, i) => [
                        `${i}-${Math.random().toString(36).slice(2)}`,
                        i
                    ])
                )
            }
        }
        await expect(encodeSnapshot(huge)).rejects.toThrow(ShareTooLongError)
        await expect(encodeSnapshot(huge)).rejects.toThrow(String(SHARE_LIMIT))
    })

    it('reads nonsense as nothing rather than throwing', async () => {
        for (const token of [
            '',
            'nope',
            '9abc',
            '1!!!!',
            '0' + btoa('{'),
            '1' + btoa('not gzip')
        ]) {
            await expect(decodeSnapshot(token)).resolves.toBeNull()
        }
    })

    it('refuses a snapshot from a version it does not understand', async () => {
        const future = await encodeSnapshot({ ...base, version: SNAPSHOT_VERSION + 1 })
        await expect(decodeSnapshot(future)).resolves.toBeNull()
    })
})
