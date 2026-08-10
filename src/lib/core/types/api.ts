import type { GridSnapshot } from './grid.js'

/**
 * The imperative surface on `grid.api`: one flat bag of methods.
 *
 * The kernel's two are always there. A feature adds its own by augmenting this
 * interface from its module, and those are optional — a grid without
 * `pagination()` has no `setPage`, so calls through here need `?.`.
 * `getPagination(grid)` is the typed path, with nothing optional about it.
 */
export interface GridApi {
    /** The grid's layout, sort, filter and density as a versioned snapshot. */
    getState(): GridSnapshot
    /** Restores what `getState` produced. */
    setState(snapshot: GridSnapshot): void
}
