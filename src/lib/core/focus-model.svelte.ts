import type { GridState } from './grid.svelte.js'
import type { Keybinding } from './types.js'

export interface CellPosition {
    row: number
    col: number
}

export const HEADER_ROW = -1

export class FocusModel<TRow> {
    active = $state.raw<CellPosition>({ row: HEADER_ROW, col: 0 })

    #grid: GridState<TRow>
    #bindings: Keybinding<TRow>[]

    constructor(grid: GridState<TRow>, featureBindings: Keybinding<TRow>[]) {
        this.#grid = grid
        this.#bindings = [...featureBindings, ...createDefaultBindings<TRow>()]
    }

    get maxRow(): number {
        return this.#grid.totalRows - 1
    }

    get maxCol(): number {
        return this.#grid.columns.visible.length - 1
    }

    focusCell = (position: CellPosition): void => {
        if (this.maxCol < 0) return
        this.active = {
            row: clamp(position.row, HEADER_ROW, Math.max(HEADER_ROW, this.maxRow)),
            col: clamp(position.col, 0, this.maxCol)
        }
    }

    moveBy = (rows: number, cols: number): void => {
        this.focusCell({ row: this.active.row + rows, col: this.active.col + cols })
    }

    pageStep(): number {
        const virtualization = this.#grid.state['virtualization'] as
            { virtualizer?: { viewportHeight: number; rowHeight: number } } | undefined
        const virtualizer = virtualization?.virtualizer
        if (virtualizer && virtualizer.viewportHeight > 0) {
            return Math.max(1, Math.floor(virtualizer.viewportHeight / virtualizer.rowHeight))
        }

        const pagination = this.#grid.state['pagination'] as
            { pageSize?: number | null } | undefined
        if (pagination?.pageSize) return pagination.pageSize

        return 10
    }

    handleKeydown = (event: KeyboardEvent): boolean => {
        const descriptor = describeKey(event)
        const binding = this.#bindings.find((candidate) => candidate.key === descriptor)
        if (!binding) return false

        event.preventDefault()
        binding.handler(this.#grid, event)
        return true
    }
}

function describeKey(event: KeyboardEvent): string {
    let descriptor = ''
    if (event.ctrlKey || event.metaKey) descriptor += 'Ctrl+'
    if (event.altKey) descriptor += 'Alt+'
    if (event.shiftKey) descriptor += 'Shift+'
    return descriptor + event.key
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max)
}

function createDefaultBindings<TRow>(): Keybinding<TRow>[] {
    return [
        { key: 'ArrowDown', handler: (grid) => grid.focus.moveBy(1, 0) },
        { key: 'ArrowUp', handler: (grid) => grid.focus.moveBy(-1, 0) },
        { key: 'ArrowLeft', handler: (grid) => grid.focus.moveBy(0, -1) },
        { key: 'ArrowRight', handler: (grid) => grid.focus.moveBy(0, 1) },
        {
            key: 'Home',
            handler: (grid) => grid.focus.focusCell({ row: grid.focus.active.row, col: 0 })
        },
        {
            key: 'End',
            handler: (grid) =>
                grid.focus.focusCell({ row: grid.focus.active.row, col: grid.focus.maxCol })
        },
        { key: 'Ctrl+Home', handler: (grid) => grid.focus.focusCell({ row: 0, col: 0 }) },
        {
            key: 'Ctrl+End',
            handler: (grid) =>
                grid.focus.focusCell({ row: grid.focus.maxRow, col: grid.focus.maxCol })
        },
        { key: 'PageDown', handler: (grid) => grid.focus.moveBy(grid.focus.pageStep(), 0) },
        { key: 'PageUp', handler: (grid) => grid.focus.moveBy(-grid.focus.pageStep(), 0) },
        {
            key: 'Enter',
            handler: (grid) => {
                const { row, col } = grid.focus.active
                if (row !== HEADER_ROW) return
                const column = grid.columns.visible[col]
                const toggleSort = grid.api['toggleSort'] as ((id: string) => void) | undefined
                if (column && toggleSort) toggleSort(column.id)
            }
        }
    ]
}
