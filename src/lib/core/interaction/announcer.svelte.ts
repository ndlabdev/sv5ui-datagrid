import type { GridState } from '../grid/grid.svelte.js'
import type { DataGridAnnouncerStrings } from '../types/index.js'

export const defaultAnnouncerStrings: DataGridAnnouncerStrings = {
    sorted: (column, direction) =>
        `sorted by ${column} ${direction === 'asc' ? 'ascending' : 'descending'}`,
    sortCleared: () => 'sort cleared',
    filtered: (count) => `${count} rows`,
    page: (page) => `page ${page}`,
    columnResized: (column, width) => `${column} column resized to ${width} pixels`,
    columnMoved: (column, position) => `${column} column moved to position ${position}`,
    columnPinned: (column, side) =>
        side ? `${column} column pinned ${side}` : `${column} column unpinned`,
    columnVisibility: (column, hidden) => `${column} column ${hidden ? 'hidden' : 'shown'}`,
    selected: (count) => `${count} rows selected`,
    copied: (count) => `${count} rows copied`,
    rowExpanded: (expanded) => (expanded ? 'row expanded' : 'row collapsed'),
    rowPinned: (side) => (side ? `row pinned ${side}` : 'row unpinned'),
    rowMoved: (position) => `row moved to position ${position}`,
    editInvalid: (message) => message
}

export class Announcer<TRow> {
    message = $state('')

    announce(message: string): void {
        this.message = message
    }

    /**
     * The strings are read when something is announced, not when the announcer
     * is built: switching language has to reach a grid that is already on
     * screen, without tearing it down.
     */
    constructor(grid: GridState<TRow>, strings: () => DataGridAnnouncerStrings) {
        const locale = () => strings()
        grid.events.on('sortChanged', ({ sort }) => {
            if (sort.length === 0) {
                this.message = locale().sortCleared()
                return
            }
            const [first] = sort
            const header = grid.columns.get(first.columnId)?.header ?? first.columnId
            this.message = locale().sorted(header, first.direction)
        })
        grid.events.on('filterChanged', () => {
            this.message = locale().filtered(grid.totalRows)
        })
        grid.events.on('pageChanged', ({ page }) => {
            this.message = locale().page(page)
        })

        const headerOf = (columnId: string) => grid.columns.get(columnId)?.header ?? columnId
        grid.events.on('columnResized', ({ columnId, width }) => {
            this.message = locale().columnResized(headerOf(columnId), width)
        })
        grid.events.on('columnMoved', ({ columnId, toIndex }) => {
            this.message = locale().columnMoved(headerOf(columnId), toIndex + 1)
        })
        grid.events.on('columnPinned', ({ columnId, side }) => {
            this.message = locale().columnPinned(headerOf(columnId), side)
        })
        grid.events.on('columnVisibilityChanged', ({ columnId, hidden }) => {
            this.message = locale().columnVisibility(headerOf(columnId), hidden)
        })
        grid.events.on('selectionChanged', ({ selectedIds }) => {
            this.message = locale().selected(selectedIds.length)
        })
        grid.events.on('rowsCopied', ({ count }) => {
            this.message = locale().copied(count)
        })
        grid.events.on('rowExpanded', ({ expanded }) => {
            this.message = locale().rowExpanded(expanded)
        })
        grid.events.on('rowPinnedChanged', ({ side }) => {
            this.message = locale().rowPinned(side)
        })
        grid.events.on('rowMoved', ({ to }) => {
            this.message = locale().rowMoved(to + 1)
        })
    }
}
