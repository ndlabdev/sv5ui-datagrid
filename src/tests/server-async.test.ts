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

/**
 * What an app can rely on while it is fetching.
 *
 * A server row model is a conversation: the grid says what changed, the app
 * goes away and comes back with rows. Everything here is about what has to be
 * true at the moment the app is told, and what has to survive the answer
 * arriving late.
 */
interface Row {
    id: string
    name: string
}

const columns: ColumnDef<Row>[] = [
    { id: 'name', sortable: true, filter: 'text' }
]

function pageOf(page: number, pageSize: number, total: number): Row[] {
    const start = (page - 1) * pageSize
    return Array.from({ length: Math.min(pageSize, total - start) }, (_, i) => ({
        id: String(start + i + 1),
        name: `Row ${start + i + 1}`
    }))
}

function serverGrid(pageSize = 10): GridState<Row> {
    return createDataGrid<Row>({
        columns,
        data: pageOf(1, pageSize, 100),
        getRowId: (row) => row.id,
        rowModel: 'server',
        features: [
            filtering(),
            sorting(),
            selection(),
            pagination({ pageSize, rowCount: 100 })
        ]
    })
}

describe('what is true when the grid asks for rows', () => {
    it('has already reset the page when a filter changes', () => {
        const grid = serverGrid()
        const page = getPagination(grid)!
        page.setPage(5)

        let pageWhenAsked = -1
        grid.events.on('filterChanged', () => {
            pageWhenAsked = page.page
        })
        getFiltering(grid)!.setQuickFilter('row 1')

        // An app reading pagination.page in its handler must not fetch page 5
        // of a result set the filter has just reshaped.
        expect(pageWhenAsked).toBe(1)
    })

    it('has already reset the page when a sort changes', () => {
        const grid = serverGrid()
        const page = getPagination(grid)!
        page.setPage(5)

        let pageWhenAsked = -1
        grid.events.on('sortChanged', () => {
            pageWhenAsked = page.page
        })
        getSorting(grid)!.setSort([{ columnId: 'name', direction: 'asc' }])

        expect(pageWhenAsked).toBe(1)
    })

    it('reports the page it moved to, not the one that was asked for', () => {
        const grid = serverGrid()
        const page = getPagination(grid)!
        const seen: number[] = []
        grid.events.on('pageChanged', ({ page: moved }) => seen.push(moved))

        page.setPage(999)
        expect(seen).toEqual([10])
        expect(page.page).toBe(10)
    })

    it('says the page size along with the page, so one fetch has both', () => {
        const grid = serverGrid()
        const page = getPagination(grid)!
        let reported: { page: number; pageSize: number | null } | null = null
        grid.events.on('pageChanged', (event) => (reported = event))

        page.setPageSize(25)
        expect(reported).toEqual({ page: 1, pageSize: 25 })
    })
})

describe('a total that arrives after the user has moved on', () => {
    it('pulls the page back inside a list that shrank', () => {
        const grid = serverGrid()
        const page = getPagination(grid)!
        page.setPage(10)

        // The filter the user just typed left 12 rows, not 100.
        page.setRowCount(12)
        expect(page.pageCount).toBe(2)
        expect(page.page).toBe(2)
    })

    it('says a total changed only when it did', () => {
        const grid = serverGrid()
        const page = getPagination(grid)!
        let announcements = 0
        grid.events.on('rowCountChanged', () => announcements++)

        page.setRowCount(100)
        expect(announcements).toBe(0)
        page.setRowCount(40)
        expect(announcements).toBe(1)
    })

    it('leaves the rows it holds alone', () => {
        const grid = serverGrid()
        const held = grid.nodes.map((node) => node.id)
        getPagination(grid)!.setRowCount(40)
        expect(grid.nodes.map((node) => node.id)).toEqual(held)
    })
})

describe('a page that lands after the user has left it', () => {
    /** The guard every server app needs, and the reason the README shows it. */
    async function loadWith(grid: GridState<Row>, delays: number[]): Promise<string[]> {
        let inFlight = 0
        const page = getPagination(grid)!

        const load = async (wanted: number, delay: number) => {
            const ticket = ++inFlight
            await new Promise((resolve) => setTimeout(resolve, delay))
            if (ticket !== inFlight) return
            grid.data = pageOf(wanted, 10, 100)
            page.setRowCount(100)
        }

        await Promise.all(delays.map((delay, index) => load(index + 1, delay)))
        return grid.nodes.map((node) => node.id)
    }

    it('is dropped when a later one has already answered', async () => {
        const grid = serverGrid()
        // Page 1 answers slowest, page 3 fastest: without the ticket the grid
        // ends up showing page 1 while the footer says page 3.
        const shown = await loadWith(grid, [30, 20, 1])
        expect(shown[0]).toBe('21')
    })
})

describe('a selection outlives the rows it was made on', () => {
    it('survives the page being replaced', () => {
        const grid = serverGrid()
        const select = getSelection(grid)!
        select.select('3')

        grid.data = pageOf(2, 10, 100)
        expect(select.count).toBe(1)

        grid.data = pageOf(1, 10, 100)
        expect(select.isSelected('3')).toBe(true)
    })

    it('counts what it holds, not what is on screen', () => {
        const grid = serverGrid()
        const select = getSelection(grid)!
        select.selectAll()
        expect(select.count).toBe(10)

        grid.data = pageOf(2, 10, 100)
        select.selectAll()
        expect(select.count).toBe(20)
    })

    it('reads select-all against the page the grid is holding', () => {
        const grid = serverGrid()
        const select = getSelection(grid)!
        select.selectAll()
        expect(select.allState).toBe('all')

        grid.data = pageOf(2, 10, 100)
        expect(select.allState).toBe('none')
    })
})
