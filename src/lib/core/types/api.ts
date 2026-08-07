import type { GridSnapshot } from './grid.js'

/**
 * The imperative surface on `grid.api`.
 *
 * The kernel's own two methods are always there. Everything else is contributed
 * by a feature, which declares it by augmenting this interface from its own
 * module — the built-ins do exactly what a feature you write would do. A
 * contributed method is optional, because the grid that has it is the one that
 * registered the feature, and a grid without `pagination()` genuinely has no
 * `setPage` to call.
 *
 * `grid.api` is therefore the flat, late-bound surface: one bag of methods, a
 * `?.` at each call. `getPagination(grid)` is the typed path, narrowing to the
 * feature's own class with nothing optional about it.
 *
 * ```ts
 * grid.api.setPage?.(2)
 * getPagination(grid)?.setPage(2)
 * ```
 */
export interface GridApi {
    /** The grid's layout, sort, filter and density as a versioned snapshot. */
    getState(): GridSnapshot
    /** Restores what `getState` produced. */
    setState(snapshot: GridSnapshot): void
}
