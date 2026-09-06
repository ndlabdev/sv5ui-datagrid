import { createDataGrid } from '../../core/grid/index.js'
import { type ColumnDef } from '../../core/types/index.js'
import { editing } from '../../features/editing/index.js'
import { filtering } from '../../features/filtering/index.js'
import { pagination } from '../../features/pagination/index.js'
import { sorting } from '../../features/sorting/index.js'
import { describe, expect, it } from 'vitest'
import { findReplace, getFindReplace } from './find-replace.svelte.js'

interface Row {
    id: number
    name: string
    city: string
    note: string
    ref: string
}
const columns: ColumnDef<Row>[] = [
    { id: 'name', header: 'Name', editable: true, filter: 'text' },
    { id: 'city', header: 'City', editable: true, filter: 'text' },
    { id: 'note', header: 'Note', editable: true },
    { id: 'ref', header: 'Ref' }
]
const CITIES = ['Hà Nội', 'Hà Nam', 'Đà Nẵng', 'Huế']
const NOTES = ['ship 2026', 'hold 2026', 'ship 2025', 'review 2026']
const seed = (): Row[] =>
    Array.from({ length: 24 }, (_, i) => ({
        id: i + 1,
        name: ['Anna', 'anna', 'ANNA', 'Bình', 'Chi', 'Dũng'][i % 6]!,
        city: CITIES[i % 4]!,
        note: NOTES[i % 4]!,
        ref: `REF-2026-${String(i + 1).padStart(3, '0')}`
    }))

function makeGrid(paged = false) {
    return createDataGrid<Row>({
        columns,
        data: seed(),
        getRowId: (r) => String(r.id),
        features: [
            sorting(),
            filtering(),
            editing(),
            ...(paged ? [pagination<Row>({ pageSize: 8 })] : []),
            findReplace()
        ]
    })
}
function open(grid: ReturnType<typeof makeGrid>, q: string) {
    const s = getFindReplace(grid)!
    s.show()
    s.query = q
    return s
}

describe('the /find checklist', () => {
    it('1. matching case narrows the result', () => {
        const s = open(makeGrid(), 'anna')
        const loose = s.total
        s.caseSensitive = true
        expect(s.total).toBeLessThan(loose)
    })
    it('2. whole-cell rejects a prefix that a partial match accepts', () => {
        const s = open(makeGrid(), 'Hà')
        const partial = s.total
        s.wholeCell = true
        expect(partial).toBeGreaterThan(0)
        expect(s.total).toBe(0)
    })
    it('5. replace-all rewrites what it can and leaves read-only columns alone', () => {
        const grid = makeGrid()
        const s = open(grid, '2026')
        s.replacement = '2027'
        s.replaceAll()
        const notes = grid.data.filter((r) => r.note.includes('2027')).length
        const refs = grid.data.filter((r) => r.ref.includes('2027')).length
        expect(refs).toBe(0)
        expect(notes).toBeGreaterThan(0)
    })
    it('7. a filter that hides the matches leaves nothing to find', () => {
        const grid = makeGrid()
        const s = open(grid, 'Hà')
        ;(grid.api.setColumnFilter as (c: string, f: unknown) => void)('city', {
            kind: 'text',
            op: 'equals',
            value: 'Huế'
        })
        expect(s.total).toBe(0)
    })
    it('10. stepping to a match on another page turns to it', () => {
        const grid = makeGrid(true)
        const s = open(grid, 'REF-2026-020')
        const page = grid.feature<{ page: number }>('pagination')!
        s.step(1)
        expect(page.page).toBe(3)
    })
    it('11. the query is text, not a pattern', () => {
        const grid = makeGrid()
        grid.data = [{ id: 99, name: 'a.b', city: 'x', note: 'cost (net)', ref: 'r' }]
        const s = open(grid, '(net)')
        expect(s.total).toBe(1)
    })
    it('12. closing clears every highlight', () => {
        const grid = makeGrid()
        const s = open(grid, 'Hà')
        expect(s.cellDecoration(0, 1)).toBeTruthy()
        s.hide()
        expect(s.cellDecoration(0, 1)).toBeUndefined()
    })
})
