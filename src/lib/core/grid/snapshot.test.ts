import { describe, expect, it } from 'vitest'
import {
    buildColumnSnapshot,
    isDensity,
    normalizeSnapshot,
    resolveColumnSnapshot,
    type ColumnSnapshotSource
} from './snapshot.js'
import { SNAPSHOT_VERSION, type GridSnapshot } from '../types/index.js'

const empty: ColumnSnapshotSource = {
    orderIds: [],
    widthOverrides: {},
    hiddenOverrides: {},
    pinnedOverrides: {},
    collapsedGroups: {}
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

describe('folded groups in a snapshot', () => {
    it('round-trips the groups the user folded', () => {
        const stored = buildColumnSnapshot({ ...empty, collapsedGroups: { pay: true } })
        expect(stored).toEqual({ collapsed: { pay: true } })

        expect(resolveColumnSnapshot(stored, ['total'], ['pay']).collapsedGroups).toEqual({
            pay: true
        })
    })

    it('drops a group the columns no longer have', () => {
        const stored = { collapsed: { pay: true, gone: true } }
        expect(resolveColumnSnapshot(stored, ['total'], ['pay']).collapsedGroups).toEqual({
            pay: true
        })
    })

    it('reads a snapshot written before groups could fold', () => {
        expect(resolveColumnSnapshot({ widths: { a: 10 } }, ['a']).collapsedGroups).toEqual({})
    })

    it('keys groups apart from columns', () => {
        // A column id is not a group id, whatever it is called.
        expect(
            resolveColumnSnapshot({ collapsed: { total: true } }, ['total'], ['pay'])
                .collapsedGroups
        ).toEqual({})
    })
})

describe('a column snapshot that has been outside the grid', () => {
    const knownIds = ['a', 'b']

    it('ignores an order that is not a list', () => {
        expect(resolveColumnSnapshot({ order: 'a' }, knownIds).orderIds).toEqual([])
        expect(resolveColumnSnapshot({ order: 42 }, knownIds).orderIds).toEqual([])
    })

    it('keeps only the string ids in an order', () => {
        expect(resolveColumnSnapshot({ order: [null, 7, 'b'] }, knownIds).orderIds).toEqual([
            'b',
            'a'
        ])
    })

    it('drops a width the layout could not draw', () => {
        const widths = {
            a: Number.NaN,
            b: Number.POSITIVE_INFINITY
        }
        expect(resolveColumnSnapshot({ widths }, knownIds).widthOverrides).toEqual({})
    })

    it('drops a width that is not a number at all', () => {
        expect(
            resolveColumnSnapshot({ widths: { a: '120', b: null } }, knownIds).widthOverrides
        ).toEqual({})
    })

    it('keeps a width it can draw, negative included, since the model clamps it', () => {
        expect(
            resolveColumnSnapshot({ widths: { a: 120, b: -5 } }, knownIds).widthOverrides
        ).toEqual({ a: 120, b: -5 })
    })

    it('keeps only real booleans for hidden and collapsed', () => {
        const stored = { hidden: { a: 'yes', b: true }, collapsed: { g: 1 } }
        const resolved = resolveColumnSnapshot(stored, knownIds, ['g'])
        expect(resolved.hiddenOverrides).toEqual({ b: true })
        expect(resolved.collapsedGroups).toEqual({})
    })

    it('reads an unpinnable side as unpinned rather than dropping the entry', () => {
        expect(
            resolveColumnSnapshot({ pinned: { a: 'middle' } }, knownIds).pinnedOverrides
        ).toEqual({ a: null })
    })

    it('takes a columns slice that is not an object as nothing at all', () => {
        for (const stored of ['nope', 42, ['a'], null, undefined]) {
            expect(resolveColumnSnapshot(stored, knownIds)).toEqual({
                orderIds: [],
                widthOverrides: {},
                hiddenOverrides: {},
                pinnedOverrides: {},
                collapsedGroups: {}
            })
        }
    })
})
