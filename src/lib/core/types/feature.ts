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

/**
 * Why the grid is reading a cell. Each member is one way a value leaves the
 * grid, so a feature standing between the data and the user has to answer for
 * every one of them: masking `render` alone leaves the value in the clipboard,
 * in the CSV and in the text a quick filter searches.
 *
 * Sorting is deliberately absent. It reads n log n times, and a gate there
 * would undo the pass the comparators were built around; a masked column can
 * therefore still be sorted, which reveals the order of what it hides.
 */
export type CellValuePurpose = 'render' | 'export' | 'clipboard' | 'search' | 'facet' | 'edit'

/** What a `cellValue` hook is asked about: one column, one purpose. */
export interface CellValueScope<TRow> {
    /** The grid, so a feature can read the state it registered. */
    grid: GridState<TRow>
    column: ColumnState<TRow>
    purpose: CellValuePurpose
}

/**
 * Reads one cell on its way out of the grid.
 *
 * Return the value untouched — the same reference — for a cell the feature
 * leaves alone. The grid compares by identity to tell a substituted cell from
 * a plain one, and a reader handing back a fresh `new Date(value)` every time
 * reads as having substituted every cell it saw.
 *
 * Answer in the type the column draws. A built-in renderer formats what it is
 * handed, so a `'***'` on a currency column parses as no number and the cell
 * draws empty; `null` draws the column's empty text. A mark of your own needs
 * an untyped column or a `cell` snippet.
 */
export type CellValueReader<TRow> = (value: unknown, node: RowNode<TRow>) => unknown

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
    /**
     * Stands between a cell's value and every way the grid lets that value
     * out: the cell itself, its tooltip, CSV, the clipboard, the text a quick
     * filter searches, the list a set filter offers, and the draft an editor
     * opens with.
     *
     * Asked per column rather than per value: the passes that read a whole
     * column at a time — export, the clipboard, the quick filter's text, the
     * set filter's list — ask once and then loop over the rows. The render
     * path asks per drawn cell, as `cellDecoration` does, so keep the answer
     * cheap and hand back the same reader each time; returning `undefined`
     * leaves that column read straight through.
     *
     * The same reader each time is not only tidiness. The quick filter's text
     * and the set filter's value list are held per column and keyed by the
     * reader, so a fresh closure per call is correct and throws both caches
     * away: 5ms against 71ms over a 100k quick filter.
     *
     * A cell the returned reader substitutes is also a cell the grid refuses
     * to edit: an editor opened on a value the user is not being shown would
     * commit the substitute over the real data.
     */
    cellValue?: (scope: CellValueScope<TRow>) => CellValueReader<TRow> | undefined
    /** The feature's JSON-safe slice of a snapshot; undefined stays out. */
    serialize?: (grid: GridState<TRow>) => unknown
    /** Restores what `serialize` produced; a feature added later starts fresh. */
    hydrate?: (slice: unknown, grid: GridState<TRow>) => void
}
