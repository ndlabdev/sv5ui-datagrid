import { getContext, setContext } from 'svelte'
import type { GridState } from '../../core/grid/index.js'

const GRID_CONTEXT_KEY = Symbol('sv5ui-datagrid')

export function setGridContext<TRow>(grid: GridState<TRow>): void {
    setContext(GRID_CONTEXT_KEY, grid)
}

export function getGridContext<TRow>(): GridState<TRow> {
    const grid = getContext<GridState<TRow> | undefined>(GRID_CONTEXT_KEY)
    if (!grid) throw new Error('Grid parts must be used inside <Grid.Root>')
    return grid
}

/** For parts that may render outside a grid, where missing is not an error. */
export function getGridOrNull<TRow>(): GridState<TRow> | null {
    return getContext<GridState<TRow> | undefined>(GRID_CONTEXT_KEY) ?? null
}

const GRID_ELEMENT_KEY = Symbol('sv5ui-datagrid-element')

/**
 * The grid's root element, for a feature component that listens on the DOM
 * rather than drawing any of it. A getter, because the element arrives on
 * mount and the reader is set up before that.
 */
export function setGridElement(element: () => HTMLElement | null): void {
    setContext(GRID_ELEMENT_KEY, element)
}

export function getGridElement(): () => HTMLElement | null {
    return getContext<(() => HTMLElement | null) | undefined>(GRID_ELEMENT_KEY) ?? (() => null)
}
