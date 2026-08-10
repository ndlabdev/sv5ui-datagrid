import { describe, expect, it } from 'vitest'
import {
    columnOps,
    createDataGrid,
    editing,
    filtering,
    getEditing,
    getFiltering,
    getPagination,
    getRowPinning,
    getRowReorder,
    getSelection,
    getSorting,
    pagination,
    rowPinning,
    rowReorder,
    selection,
    sorting,
    type ColumnDef,
    type GridState
} from '$lib/index.js'

interface Order {
    id: number
    customer: string
    status: string
    total: number
}

const database: Order[] = Array.from({ length: 137 }, (_, i) => ({
    id: i + 1,
    customer: `Customer ${i + 1}`,
    status: ['paid', 'pending', 'refunded'][i % 3],
    total: 50 + i
}))

const columns: ColumnDef<Order>[] = [
    { id: 'id', header: '#' },
    { id: 'customer', header: 'Customer', editable: true, filter: 'text' },
    { id: 'status', header: 'Status', filter: 'set' },
    { id: 'total', header: 'Total' }
]

function pageOf(page: number, size = 10): Order[] {
    return database.slice((page - 1) * size, page * size)
}

function serverGrid(extra: ReturnType<typeof selection<Order>>[] = []): GridState<Order> {
    return createDataGrid<Order>({
        columns,
        data: pageOf(1),
        getRowId: (order) => String(order.id),
        rowModel: 'server',
        features: [
            sorting(),
            filtering(),
            columnOps(),
            selection(),
            editing(),
            pagination({ pageSize: 10, rowCount: database.length }),
            ...extra
        ]
    })
}

/** Turns the page the way an app wired to `pageChanged` would. */
function goToPage(grid: GridState<Order>, page: number): void {
    getPagination(grid)!.setPage(page)
    grid.data = pageOf(page)
}

describe('server row model — what each feature does with one page', () => {
    it('selection: count spans pages but the rows do not', () => {
        const grid = serverGrid()
        const state = getSelection(grid)!

        state.select('1')
        state.select('2')
        goToPage(grid, 2)

        expect(state.count).toBe(2)
        expect(state.getSelectedRows()).toEqual([])
        expect(state.copyText()).toBeNull()
        expect(state.allState).toBe('none')
    })

    it('selection: export with nothing on the page falls back to the page', () => {
        const grid = serverGrid()
        getSelection(grid)!.select('1')
        goToPage(grid, 2)
        expect(getSelection(grid)!.selectedNodes).toEqual([])
    })

    it('filtering: the set filter only offers values from the page it holds', () => {
        const grid = serverGrid()
        goToPage(grid, 2)
        expect(getFiltering(grid)!.distinctFor('id')).toHaveLength(10)
    })

    it('editing: reaches a row on page 2 by id', () => {
        const grid = serverGrid()
        goToPage(grid, 2)
        const state = getEditing(grid)!
        const edits: string[] = []
        grid.events.on('cellEdited', ({ rowId, newValue }) => edits.push(`${rowId}=${newValue}`))

        state.startEdit('12', 'customer')
        state.setDraft('Renamed')
        state.commit()

        expect(edits).toEqual(['12=Renamed'])
        expect(grid.data[1].customer).toBe('Renamed')
    })

    it('editing: the focused cell on page 2 is the one type-to-edit opens', () => {
        const grid = serverGrid()
        goToPage(grid, 2)
        grid.focus.focusCell({ row: 1, col: 1 })
        const node = grid.preWindowNodes[grid.focus.active.row]
        expect(node?.id).toBe('12')
    })

    it('reorder: rowMoved carries indexes into the page, not the set', () => {
        const grid = serverGrid([rowReorder<Order>() as never])
        goToPage(grid, 2)
        const moved: { from: number; to: number }[] = []
        grid.events.on('rowMoved', ({ from, to }) => moved.push({ from, to }))

        getRowReorder(grid)!.moveRow('11', 2)
        expect(moved).toEqual([{ from: 0, to: 2 }])
        expect(grid.data.map((row) => row.id)).toEqual([12, 13, 11, 14, 15, 16, 17, 18, 19, 20])
    })

    it('pinning: pins a row of the page it holds', () => {
        const grid = createDataGrid<Order>({
            columns,
            data: pageOf(2),
            getRowId: (order) => String(order.id),
            rowModel: 'server',
            features: [
                pagination({ pageSize: 10, rowCount: database.length }),
                rowPinning<Order>({ isRowPinned: (order) => (order.id === 12 ? 'top' : null) })
            ]
        })
        expect(getRowPinning(grid)!.topNodes.map((node) => node.id)).toEqual(['12'])
        expect(grid.nodes).toHaveLength(9)
    })

    it('sorting: leaves the page in the order the server sent it', () => {
        const grid = serverGrid()
        goToPage(grid, 2)
        getSorting(grid)!.setSort([{ columnId: 'total', direction: 'desc' }])
        expect(grid.nodes.map((node) => node.row.id)).toEqual([
            11, 12, 13, 14, 15, 16, 17, 18, 19, 20
        ])
    })

    it('sorting and filtering reset the page to 1 so the app refetches', () => {
        const grid = serverGrid()
        const state = getPagination(grid)!
        const pages: number[] = []
        grid.events.on('pageChanged', ({ page }) => pages.push(page))

        goToPage(grid, 3)
        getSorting(grid)!.setSort([{ columnId: 'total', direction: 'asc' }])
        expect(state.page).toBe(1)

        state.setPage(4)
        getFiltering(grid)!.setQuickFilter('paid')
        expect(state.page).toBe(1)
        expect(pages).toEqual([3, 4])
    })

    it('page count follows the server total through a filter', () => {
        const grid = serverGrid()
        const state = getPagination(grid)!
        state.setRowCount(23)
        expect(state.pageCount).toBe(3)
        state.setPage(3)
        state.setRowCount(0)
        expect(state.pageCount).toBe(1)
        expect(state.page).toBe(1)
    })

    it('announcer: waits for the server total instead of counting the page', () => {
        const grid = serverGrid()
        goToPage(grid, 2)
        grid.announcer.announce('')
        getFiltering(grid)!.setQuickFilter('paid')
        expect(grid.announcer.message).toBe('')

        getPagination(grid)!.setRowCount(46)
        expect(grid.announcer.message).toBe('46 rows')

        // A plain page turn refetches and sets the same total: not news.
        grid.announcer.announce('')
        getPagination(grid)!.setRowCount(46)
        expect(grid.announcer.message).toBe('')
    })

    it('persistence: the snapshot carries no page number', () => {
        const grid = serverGrid()
        goToPage(grid, 3)
        expect(JSON.stringify(grid.getState())).not.toContain('"page"')
    })
})
