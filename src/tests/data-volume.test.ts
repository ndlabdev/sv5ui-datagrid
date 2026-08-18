import { describe, expect, it } from 'vitest'
import type { ColumnDef, GridState } from '$lib/index.js'
import {
    createDataGrid,
    filtering,
    getFiltering,
    getPagination,
    getSelection,
    getSorting,
    pagination,
    selection,
    sorting
} from '$lib/index.js'
import { createColumnState } from '../lib/core/columns/index.js'
import { distinctValues, DISTINCT_VALUES_CAP } from '../lib/features/filtering/index.js'
import { rowsToMatrix, toCsv } from '../lib/features/selection/index.js'
import { buildRowNodes } from '../lib/core/grid/index.js'

/**
 * One row list, grown from nothing to a million, asked whether it still holds
 * every row it started with. Speed is the benchmarks' business; this is about
 * whether a page, a window or an export loses one.
 */
interface Row {
    id: string
    name: string
    score: unknown
    dept: string
}

const DEPTS = ['Core', 'Data', 'Infra', 'Ops']

/** Holes every seventh row, because a hole is where an off-by-one hides. */
function makeRows(count: number): Row[] {
    return Array.from({ length: count }, (_, i) => ({
        id: String(i + 1),
        name: `Person ${(i * 7919) % Math.max(count, 1)}`,
        score: i % 7 === 0 ? null : (i * 37) % 1000,
        dept: DEPTS[i % DEPTS.length]
    }))
}

const columns: ColumnDef<Row>[] = [
    { id: 'name', sortable: true, filter: 'text' },
    { id: 'score', type: 'number', sortable: true, filter: 'number' },
    { id: 'dept', sortable: true, filter: 'set' }
]

function gridOf(rows: Row[], pageSize?: number): GridState<Row> {
    return createDataGrid<Row>({
        columns,
        data: rows,
        getRowId: (row) => row.id,
        features: [filtering(), sorting({ nulls: 'last' }), selection(), pagination({ pageSize })]
    })
}

const SIZES = [0, 1, 2, 9, 10, 11, 99, 100, 101, 1000]

describe('paging never loses a row, whatever the size', () => {
    it.each(SIZES)('walks every page of %i rows exactly once', (count) => {
        const grid = gridOf(makeRows(count), 10)
        const page = getPagination(grid)!
        const seen: string[] = []

        for (let n = 1; n <= page.pageCount; n++) {
            page.setPage(n)
            seen.push(...grid.nodes.map((node) => node.id))
        }

        expect(seen).toHaveLength(count)
        expect(new Set(seen).size).toBe(count)
    })

    it.each(SIZES)('sizes the last page of %i rows by what is left', (count) => {
        const grid = gridOf(makeRows(count), 10)
        const page = getPagination(grid)!
        page.setPage(page.pageCount)
        const remainder = count % 10
        const expected = count === 0 ? 0 : remainder === 0 ? 10 : remainder
        expect(grid.nodes).toHaveLength(expected)
    })

    it('clamps a page asked for past the end', () => {
        const grid = gridOf(makeRows(25), 10)
        const page = getPagination(grid)!
        page.setPage(999)
        expect(page.page).toBe(3)
        expect(grid.nodes).toHaveLength(5)
    })

    it('holds a page while the rows under it shrink', () => {
        const grid = gridOf(makeRows(100), 10)
        const page = getPagination(grid)!
        page.setPage(10)
        getFiltering(grid)!.setColumnFilter('dept', { kind: 'set', values: ['Core'] })
        // Filtering resets to the first page rather than stranding the reader
        // on a page that no longer exists.
        expect(page.page).toBe(1)
        expect(grid.nodes.length).toBeGreaterThan(0)
    })
})

describe('sorting keeps the list it was given', () => {
    it.each([...SIZES, 100_000])('is a permutation of %i rows', (count) => {
        const grid = gridOf(makeRows(count))
        getSorting(grid)!.setSort([{ columnId: 'score', direction: 'asc' }])
        const ids = grid.nodes.map((node) => node.id)
        expect(ids).toHaveLength(count)
        expect(new Set(ids).size).toBe(count)
    })

    it('puts every hole at one end and orders the rest', () => {
        const grid = gridOf(makeRows(1000))
        getSorting(grid)!.setSort([{ columnId: 'score', direction: 'asc' }])
        const scores = grid.nodes.map((node) => node.row.score)

        const holes = scores.filter((score) => score === null)
        expect(holes).toHaveLength(Math.ceil(1000 / 7))
        expect(scores.slice(scores.length - holes.length).every((score) => score === null)).toBe(
            true
        )

        const numbers = scores.slice(0, scores.length - holes.length) as number[]
        expect(numbers.every((score, i) => i === 0 || numbers[i - 1] <= score)).toBe(true)
    })

    it('breaks ties by the order the rows arrived in', () => {
        const grid = gridOf(makeRows(1000))
        getSorting(grid)!.setSort([{ columnId: 'dept', direction: 'asc' }])
        const byDept = new Map<string, number[]>()
        for (const node of grid.nodes) {
            const seen = byDept.get(node.row.dept) ?? []
            seen.push(Number(node.id))
            byDept.set(node.row.dept, seen)
        }
        for (const ids of byDept.values()) {
            expect(ids.every((id, i) => i === 0 || ids[i - 1] < id)).toBe(true)
        }
    })
})

describe('the quick filter answers the same as reading every cell', () => {
    /** What the cache has to agree with, at every size. */
    function naive(rows: Row[], query: string): string[] {
        const needle = query.toLowerCase()
        return rows
            .filter((row) =>
                [row.name, String(row.score ?? ''), row.dept].some((cell) =>
                    cell.toLowerCase().includes(needle)
                )
            )
            .map((row) => row.id)
    }

    it.each([...SIZES, 100_000])('agrees over %i rows', (count) => {
        const rows = makeRows(count)
        const grid = gridOf(rows)
        const state = getFiltering(grid)!

        for (const query of ['person 12', 'core', '7', 'nothing here']) {
            state.setQuickFilter(query)
            expect(grid.nodes.map((node) => node.id)).toEqual(naive(rows, query))
        }
    })

    it('answers the same after the rows behind it change', () => {
        const rows = makeRows(1000)
        const grid = gridOf(rows)
        const state = getFiltering(grid)!
        state.setQuickFilter('core')
        const before = grid.nodes.length

        // A new array of the same rows: the cache is keyed by row, so this is
        // the case where it must still be right rather than merely fast.
        grid.data = [...rows]
        expect(grid.nodes).toHaveLength(before)

        grid.data = makeRows(500)
        expect(grid.nodes.map((node) => node.id)).toEqual(naive(makeRows(500), 'core'))
    })
})

describe('selection and export carry the whole list', () => {
    it.each([...SIZES, 100_000])('selects all %i rows and counts them', (count) => {
        const grid = gridOf(makeRows(count))
        const state = getSelection(grid)!
        state.selectAll()
        expect(state.count).toBe(count)
        expect(state.allState).toBe(count === 0 ? 'none' : 'all')
    })

    it('exports every filtered row, not the page in view', () => {
        const grid = gridOf(makeRows(1000), 10)
        const states = grid.columns.visible
        const matrix = rowsToMatrix(grid.preWindowNodes, states)
        expect(matrix).toHaveLength(1000)
        expect(grid.nodes).toHaveLength(10)
    })

    it.each([1000, 100_000])('writes %i rows as that many lines', (count) => {
        const nodes = buildRowNodes(makeRows(count), (row) => row.id)
        const states = columns.map((def) => createColumnState(def))
        const csv = toCsv(rowsToMatrix(nodes, states))
        expect(csv.split('\r\n')).toHaveLength(count)
    })

    it('keeps a selection through a filter that hides it and back', () => {
        const grid = gridOf(makeRows(1000))
        const select = getSelection(grid)!
        const filter = getFiltering(grid)!

        select.select('5')
        filter.setColumnFilter('dept', { kind: 'set', values: ['Ops'] })
        expect(select.count).toBe(1)
        filter.clearColumnFilters()
        expect(select.isSelected('5')).toBe(true)
    })
})

describe('a million rows', () => {
    // One size the rest of the suite cannot afford to run at every assertion,
    // kept to the properties that would hide a lost row.
    const rows = makeRows(1_000_000)

    /**
     * These do a million rows of real work each, so the default five seconds
     * is not a deadline they should be held to: it is the deadline for a test
     * that has hung. A shared runner is slower than the machine this was
     * written on, and one of them passed here and timed out there, which is
     * worse than being slow.
     */
    const HEAVY = 60_000

    it(
        'sorts into a permutation of itself',
        () => {
            const grid = gridOf(rows)
            getSorting(grid)!.setSort([{ columnId: 'score', direction: 'desc' }])
            const nodes = grid.nodes
            expect(nodes).toHaveLength(1_000_000)
            expect(new Set(nodes.map((node) => node.id)).size).toBe(1_000_000)
        },
        HEAVY
    )

    it(
        'pages to the end and finds rows there',
        () => {
            const grid = gridOf(rows, 25)
            const page = getPagination(grid)!
            expect(page.pageCount).toBe(40_000)
            page.setPage(40_000)
            expect(grid.nodes).toHaveLength(25)
            expect(grid.nodes[24].id).toBe('1000000')
        },
        HEAVY
    )

    it(
        'filters down to a handful and back',
        () => {
            const grid = gridOf(rows)
            const state = getFiltering(grid)!
            state.setQuickFilter('person 999999')
            expect(grid.nodes.length).toBeGreaterThan(0)
            state.setQuickFilter('')
            expect(grid.totalRows).toBe(1_000_000)
        },
        HEAVY
    )
})

describe('the value list stays a list a person can read', () => {
    it('caps what it offers however many rows there are', () => {
        const nodes = buildRowNodes(makeRows(100_000), (row) => row.id)
        const values = distinctValues(nodes, { id: 'name' })
        expect(values.length).toBeLessThanOrEqual(DISTINCT_VALUES_CAP)
        expect(new Set(values).size).toBe(values.length)
    })

    it('offers every value of a small column without capping it', () => {
        const nodes = buildRowNodes(makeRows(1000), (row) => row.id)
        expect(distinctValues(nodes, { id: 'dept' })).toEqual(DEPTS.toSorted())
    })
})
