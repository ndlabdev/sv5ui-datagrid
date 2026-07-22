import { describe, expect, it } from 'vitest'
import {
    buildColumnCssVars,
    columnTrackSize,
    createColumnState,
    prefixSums,
    resolveColumnWidths,
    toStyleString
} from './column-sizing.js'

describe('createColumnState', () => {
    it('resolves defaults from the definition', () => {
        const column = createColumnState({ id: 'name' })
        expect(column).toMatchObject({
            id: 'name',
            header: 'name',
            minWidth: 40,
            hidden: false,
            align: 'left',
            cssVar: '--dg-col-name-w'
        })
    })

    it('sanitizes the column id for the CSS custom property', () => {
        expect(createColumnState({ id: 'user.name' }).cssVar).toBe('--dg-col-user-name-w')
    })
})

describe('columnTrackSize', () => {
    it('renders a fixed width in pixels', () => {
        expect(columnTrackSize(createColumnState({ id: 'a', width: 96 }))).toBe('96px')
    })

    it('clamps a fixed width to min and max', () => {
        expect(columnTrackSize(createColumnState({ id: 'a', width: 30 }))).toBe('40px')
        expect(columnTrackSize(createColumnState({ id: 'a', width: 500, maxWidth: 300 }))).toBe(
            '300px'
        )
    })

    it('renders flex columns as minmax tracks', () => {
        expect(columnTrackSize(createColumnState({ id: 'a' }))).toBe('minmax(40px, 1fr)')
        expect(columnTrackSize(createColumnState({ id: 'a', flex: 2, minWidth: 60 }))).toBe(
            'minmax(60px, 2fr)'
        )
    })
})

describe('buildColumnCssVars', () => {
    it('emits one variable per column plus the grid template', () => {
        const columns = [
            createColumnState({ id: 'a', width: 96 }),
            createColumnState({ id: 'b', flex: 2 })
        ]
        expect(buildColumnCssVars(columns)).toEqual({
            '--dg-col-a-w': '96px',
            '--dg-col-b-w': 'minmax(40px, 2fr)',
            '--dg-grid-template': 'var(--dg-col-a-w) var(--dg-col-b-w)'
        })
    })
})

describe('resolveColumnWidths', () => {
    it('keeps fixed widths and distributes the rest by flex weight', () => {
        const columns = [
            createColumnState({ id: 'a', width: 100 }),
            createColumnState({ id: 'b', flex: 1 }),
            createColumnState({ id: 'c', flex: 3 })
        ]
        expect(resolveColumnWidths(columns, 500)).toEqual([100, 100, 300])
    })

    it('pins flex columns at minWidth and redistributes (two-pass)', () => {
        const columns = [
            createColumnState({ id: 'a', flex: 1, minWidth: 200 }),
            createColumnState({ id: 'b', flex: 1, minWidth: 40 })
        ]
        expect(resolveColumnWidths(columns, 300)).toEqual([200, 100])
    })

    it('falls back to minWidth for every flex column when space runs out', () => {
        const columns = [
            createColumnState({ id: 'a', width: 400 }),
            createColumnState({ id: 'b', flex: 1, minWidth: 120 }),
            createColumnState({ id: 'c', flex: 1, minWidth: 80 })
        ]
        expect(resolveColumnWidths(columns, 300)).toEqual([400, 120, 80])
    })

    it('respects maxWidth on flex columns', () => {
        const columns = [
            createColumnState({ id: 'a', flex: 1, maxWidth: 100 }),
            createColumnState({ id: 'b', flex: 1 })
        ]
        expect(resolveColumnWidths(columns, 600)).toEqual([100, 500])
    })
})

describe('prefixSums', () => {
    it('builds n+1 offsets starting at zero', () => {
        expect(prefixSums([100, 50, 200])).toEqual([0, 100, 150, 350])
        expect(prefixSums([])).toEqual([0])
    })
})

describe('toStyleString', () => {
    it('serializes variables into an inline style', () => {
        expect(toStyleString({ '--a': '1px', '--b': '2px' })).toBe('--a: 1px; --b: 2px')
    })
})
