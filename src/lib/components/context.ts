import { getContext, setContext } from 'svelte'
import type { GridState } from '../core/grid.svelte.js'

const GRID_CONTEXT_KEY = Symbol('sv5ui-datagrid')

export function setGridContext<TRow>(grid: GridState<TRow>): void {
    setContext(GRID_CONTEXT_KEY, grid)
}

export function getGridContext<TRow>(): GridState<TRow> {
    const grid = getContext<GridState<TRow> | undefined>(GRID_CONTEXT_KEY)
    if (!grid) throw new Error('Grid parts must be used inside <Grid.Root>')
    return grid
}
