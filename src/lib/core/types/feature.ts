import type { GridState } from '../grid/grid.svelte.js'
import type { ColumnState } from './columns.js'
import type { RowNode } from './rows.js'

/** The extension points a feature module plugs into. */

/**
 * An ordered transform inserted into the row pipeline.
 * Every stage is a pure function of the node list and grid state.
 */
export interface PipelineStage<TRow> {
    /**
     * Position in the pipeline. Core orders: filter 100, sort 200,
     * group 300, flatten 400, pin-split 500, window 900.
     */
    order: number
    /** Pure transform of the node list. */
    transform: (nodes: RowNode<TRow>[], grid: GridState<TRow>) => RowNode<TRow>[]
}

/**
 * A keyboard binding contributed to the focus model.
 * Dispatched by the FocusModel (phase 1, part 2).
 */
export interface Keybinding<TRow> {
    /** Key descriptor, e.g. `'ArrowDown'`, `'Ctrl+Home'`. */
    key: string
    /**
     * Guard evaluated before the handler. When it returns false the
     * binding is skipped and later bindings may match the same key.
     */
    when?: (grid: GridState<TRow>) => boolean
    /** Invoked when the key matches while the grid has focus. */
    handler: (grid: GridState<TRow>, event: KeyboardEvent) => void
}

/**
 * The cell a `cellDecoration` hook is being asked about. `rowIndex` and
 * `colIndex` are absolute positions within the filtered/sorted set, matching
 * the cell's `data-dg-cell="row:col"` attribute.
 */
export interface CellDecorationContext<TRow> {
    /** The grid, so a feature can read the state it registered. */
    grid: GridState<TRow>
    node: RowNode<TRow>
    column: ColumnState<TRow>
    rowIndex: number
    colIndex: number
}

/** Styling a feature applies to one cell. */
export interface CellDecoration {
    /** Classes merged onto the cell element. */
    class?: string
    /** Sets `aria-selected` on the cell. */
    selected?: boolean
}

/** Context handed to feature menu-item factories. */
export interface MenuContext<TRow> {
    grid: GridState<TRow>
    /** Set when the menu targets a column. */
    columnId?: string
    /** Set when the menu targets a row. */
    node?: RowNode<TRow>
}

export interface MenuItem {
    id: string
    label: string
    icon?: string
    disabled?: boolean
    onSelect: () => void
}

/**
 * A feature is an object plugging into well-defined extension points.
 * Unused features are never imported, so they are never bundled.
 */
export interface GridFeature<TRow> {
    /** Unique feature id; also the key of its state on `grid.state`. */
    id: string
    /** Ordered transform inserted into the row pipeline. */
    pipelineStage?: PipelineStage<TRow>
    /** Reactive state the feature owns, exposed on `grid.state[id]`. */
    createState?: (grid: GridState<TRow>) => unknown
    /** Imperative methods merged into `grid.api`. */
    createApi?: (grid: GridState<TRow>) => Record<string, unknown>
    /** Keyboard bindings contributed to the focus model. */
    keybindings?: Keybinding<TRow>[]
    /** Column menu / context menu items contributed by the feature. */
    menuItems?: (ctx: MenuContext<TRow>) => MenuItem[]
    /**
     * Per-cell styling contributed by the feature — range highlights,
     * validation marks, heatmaps. Runs for every rendered cell, so keep it
     * cheap; grids without a decorating feature skip the work entirely.
     */
    cellDecoration?: (ctx: CellDecorationContext<TRow>) => CellDecoration | undefined
    /**
     * The feature's slice of a state snapshot, stored under its id. Return
     * undefined to stay out of the snapshot entirely. Must be JSON-safe.
     */
    serialize?: (grid: GridState<TRow>) => unknown
    /**
     * Restores what `serialize` produced. Called only when the snapshot holds
     * a slice for this feature, so a feature added later simply starts fresh.
     */
    hydrate?: (slice: unknown, grid: GridState<TRow>) => void
}
