import { getContext, setContext } from 'svelte'
import type { GridState } from '../../core/grid/index.js'

const GRID_CONTEXT_KEY = Symbol('sv5ui-datagrid')

export function setGridContext<TRow>(grid: GridState<TRow>): void {
    setContext(GRID_CONTEXT_KEY, grid)
}

/**
 * The grid a part is drawn inside, read from context.
 *
 * This is how a feature's `component` reaches the grid it belongs to: it is
 * mounted inside the grid's root, so the context is already there and no props
 * are handed to it. Throws outside a grid, which is a mistake rather than a
 * state to handle.
 */
export function getGridContext<TRow>(): GridState<TRow> {
    const grid = getContext<GridState<TRow> | undefined>(GRID_CONTEXT_KEY)
    if (!grid) throw new Error('Grid parts must be used inside <Grid.Root>')
    return grid
}

export function getGridOrNull<TRow>(): GridState<TRow> | null {
    return getContext<GridState<TRow> | undefined>(GRID_CONTEXT_KEY) ?? null
}

const GRID_ELEMENT_KEY = Symbol('sv5ui-datagrid-element')

export function setGridElement(element: () => HTMLElement | null): void {
    setContext(GRID_ELEMENT_KEY, element)
}

/**
 * Reads the grid's own root element, for the work that needs the DOM: a
 * listener, a measurement, a layer drawn over the rows.
 *
 * It answers a getter rather than the element, because the element arrives
 * after the first paint. Call it when you need it; outside a grid, and before
 * the root is bound, it answers `null`.
 */
export function getGridElement(): () => HTMLElement | null {
    return getContext<(() => HTMLElement | null) | undefined>(GRID_ELEMENT_KEY) ?? (() => null)
}
