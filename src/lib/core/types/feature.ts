import type { GridState } from '../grid/grid.svelte.js'
import type { GridApi } from './api.js'
import type { ColumnState } from './columns.js'
import type { RowNode } from './rows.js'

/** The extension points a feature module plugs into. */

/** An ordered, pure transform inserted into the row pipeline. */
export interface PipelineStage<TRow> {
    /**
     * Position in the pipeline. Core orders: filter 100, sort 200,
     * group 300, flatten 400, pin-split 500, window 900.
     */
    order: number
    /** Pure transform of the node list. */
    transform: (nodes: RowNode<TRow>[], grid: GridState<TRow>) => RowNode<TRow>[]
}

/** A keyboard binding contributed to the focus model. */
export interface Keybinding<TRow> {
    /** Key descriptor, e.g. `'ArrowDown'`, `'Ctrl+Home'`. */
    key: string
    /** False skips the binding and lets a later one match the same key. */
    when?: (grid: GridState<TRow>) => boolean
    /** Invoked when the key matches while the grid has focus. */
    handler: (grid: GridState<TRow>, event: KeyboardEvent) => void
}

/** The cell a `cellDecoration` hook is asked about, positioned as `data-dg-cell`. */
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

/** An object plugging into the extension points; unused ones never bundle. */
export interface GridFeature<TRow> {
    /** Unique feature id; also the key of its state on `grid.state`. */
    id: string
    /** Ordered transform inserted into the row pipeline. */
    pipelineStage?: PipelineStage<TRow>
    /** Reactive state the feature owns, exposed on `grid.state[id]`. */
    createState?: (grid: GridState<TRow>) => unknown
    /**
     * Imperative methods merged into `grid.api`. Declare their types by
     * augmenting `GridApi` from this module, the way the built-in features do.
     */
    createApi?: (grid: GridState<TRow>) => Partial<GridApi>
    /** Keyboard bindings contributed to the focus model. */
    keybindings?: Keybinding<TRow>[]
    /** Column menu / context menu items contributed by the feature. */
    menuItems?: (ctx: MenuContext<TRow>) => MenuItem[]
    /** Per-cell styling. Runs per rendered cell, so keep it cheap. */
    cellDecoration?: (ctx: CellDecorationContext<TRow>) => CellDecoration | undefined
    /** The feature's JSON-safe slice of a snapshot; undefined stays out. */
    serialize?: (grid: GridState<TRow>) => unknown
    /** Restores what `serialize` produced; a feature added later starts fresh. */
    hydrate?: (slice: unknown, grid: GridState<TRow>) => void
}
