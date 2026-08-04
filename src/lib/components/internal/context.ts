import { getContext, setContext } from 'svelte'
import type { GridState } from '../../core/grid/grid.svelte.js'
import { defaultLabels } from '../../core/interaction/labels.js'
import type { DataGridLabels } from '../../core/types/index.js'

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
 * Labels for parts that may legitimately render outside a grid — a cell
 * renderer reused in a card, say. Those fall back to the defaults rather than
 * throwing, because a missing translation is not worth an error.
 */
export function getGridLabels(): DataGridLabels {
    return getContext<GridState<unknown> | undefined>(GRID_CONTEXT_KEY)?.labels ?? defaultLabels
}
