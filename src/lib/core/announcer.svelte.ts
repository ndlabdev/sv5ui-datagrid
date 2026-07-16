import type { GridState } from './grid.svelte.js'
import type { DataGridLocale } from './types.js'

export const defaultLocale: DataGridLocale = {
    sorted: (column, direction) =>
        `sorted by ${column} ${direction === 'asc' ? 'ascending' : 'descending'}`,
    sortCleared: () => 'sort cleared',
    filtered: (count) => `${count} rows`,
    page: (page) => `page ${page}`
}

export class Announcer<TRow> {
    message = $state('')

    constructor(grid: GridState<TRow>, locale: DataGridLocale) {
        grid.events.on('sortChanged', ({ sort }) => {
            if (sort.length === 0) {
                this.message = locale.sortCleared()
                return
            }
            const [first] = sort
            const header = grid.columns.get(first.columnId)?.header ?? first.columnId
            this.message = locale.sorted(header, first.direction)
        })
        grid.events.on('filterChanged', () => {
            this.message = locale.filtered(grid.totalRows)
        })
        grid.events.on('pageChanged', ({ page }) => {
            this.message = locale.page(page)
        })
    }
}
