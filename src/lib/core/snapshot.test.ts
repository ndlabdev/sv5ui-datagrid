import { describe, expect, it } from 'vitest'
import {
    buildColumnSnapshot,
    isDensity,
    normalizeSnapshot,
    resolveColumnSnapshot,
    type ColumnSnapshotSource
} from './snapshot.js'
import { SNAPSHOT_VERSION, type GridSnapshot } from './types.js'

const empty: ColumnSnapshotSource = {
    orderIds: [],
    widthOverrides: {},
    hiddenOverrides: {},
    pinnedOverrides: {}
}

describe('buildColumnSnapshot', () => {
    it('stays out of the snapshot when nothing was customised', () => {
        expect(buildColumnSnapshot(empty)).toBeUndefined()
    })

    it('keeps only the buckets that hold something', () => {
        expect(buildColumnSnapshot({ ...empty, widthOverrides: { a: 120 } })).toEqual({
            widths: { a: 120 }
        })
    })

    it('copies rather than aliasing the live state', () => {
        const source = { ...empty, widthOverrides: { a: 120 } }
        const snapshot = buildColumnSnapshot(source)!
        source.widthOverrides.a = 999
        expect(snapshot.widths).toEqual({ a: 120 })
    })
})

describe('resolveColumnSnapshot', () => {
    it('drops ids that no longer exist', () => {
        const resolved = resolveColumnSnapshot(
            {
                order: ['b', 'gone', 'a'],
                widths: { gone: 100, a: 120 },
                hidden: { gone: true },
                pinned: { gone: 'left' }
            },
            ['a', 'b']
        )

        expect(resolved.orderIds).toEqual(['b', 'a'])
        expect(resolved.widthOverrides).toEqual({ a: 120 })
        expect(resolved.hiddenOverrides).toEqual({})
        expect(resolved.pinnedOverrides).toEqual({})
    })

    it('appends columns added since the snapshot was written', () => {
        const resolved = resolveColumnSnapshot({ order: ['b', 'a'] }, ['a', 'b', 'c'])
        expect(resolved.orderIds).toEqual(['b', 'a', 'c'])
    })

    it('normalizes an invalid pinned value instead of losing the column', () => {
        const resolved = resolveColumnSnapshot({ pinned: { a: 'garbage' as never, b: 'right' } }, [
            'a',
            'b'
        ])
        expect(resolved.pinnedOverrides).toEqual({ a: null, b: 'right' })
    })

    it('leaves the order untouched when the snapshot has none', () => {
        expect(resolveColumnSnapshot(undefined, ['a', 'b']).orderIds).toEqual([])
    })
})

describe('normalizeSnapshot', () => {
    const current: GridSnapshot = { version: SNAPSHOT_VERSION, density: 'compact' }

    it('accepts a snapshot of the current version', () => {
        expect(normalizeSnapshot(current)).toEqual(current)
    })

    it.each([null, undefined, 'nonsense', 42, {}, { version: 'one' }])(
        'discards malformed input %p',
        (stored) => {
            expect(normalizeSnapshot(stored)).toBeUndefined()
        }
    )

    it('runs migrate for an older version', () => {
        const stored = { version: 0, density: 'comfortable' } as GridSnapshot
        const migrated = normalizeSnapshot(stored, (old) => ({
            ...old,
            version: SNAPSHOT_VERSION
        }))
        expect(migrated).toEqual({ version: SNAPSHOT_VERSION, density: 'comfortable' })
    })

    it('discards an older snapshot when migrate declines it', () => {
        const stored = { version: 0 } as GridSnapshot
        expect(normalizeSnapshot(stored, () => undefined)).toBeUndefined()
    })

    it('discards an older snapshot when no migrate is supplied', () => {
        expect(normalizeSnapshot({ version: 0 } as GridSnapshot)).toBeUndefined()
    })

    it('rejects a migrate that forgets to bump the version', () => {
        const stored = { version: 0 } as GridSnapshot
        expect(normalizeSnapshot(stored, (old) => old)).toBeUndefined()
    })
})

describe('isDensity', () => {
    it('accepts the three densities and nothing else', () => {
        expect(['compact', 'standard', 'comfortable'].every(isDensity)).toBe(true)
        expect(isDensity('huge')).toBe(false)
        expect(isDensity(undefined)).toBe(false)
    })
})
