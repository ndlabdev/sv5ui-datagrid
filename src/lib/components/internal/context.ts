import { getContext, setContext } from 'svelte'
import type { GridState } from '../../core/grid/grid.svelte.js'

const GRID_CONTEXT_KEY = Symbol('sv5ui-datagrid')

export function setGridContext<TRow>(grid: GridState<TRow>): void {
    setContext(GRID_CONTEXT_KEY, grid)
}

export function getGridContext<TRow>(): GridState<TRow> {
    const grid = getContext<GridState<TRow> | undefined>(GRID_CONTEXT_KEY)
    if (!grid) throw new Error('Grid parts must be used inside <Grid.Root>')
    return grid
}

/**
 * The grid, or null. For parts that may legitimately render outside one — a
 * cell renderer reused in a card, say — where a missing grid is not an error.
 * Read through it inside a `$derived` so language changes still land.
 */
export function getGridOrNull<TRow>(): GridState<TRow> | null {
    return getContext<GridState<TRow> | undefined>(GRID_CONTEXT_KEY) ?? null
}
