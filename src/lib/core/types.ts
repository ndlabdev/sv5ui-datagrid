import type { Snippet } from 'svelte'
import type { GridState } from './grid.svelte.js'

export type SortDirection = 'asc' | 'desc'

export interface SortState {
    /** The id of the column being sorted. */
    columnId: string
    /** The active sort direction. */
    direction: SortDirection
}

export type TextFilterOp = 'contains' | 'equals' | 'startsWith' | 'endsWith' | 'blank'
export type NumberFilterOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'blank'
export type DateFilterOp = 'equals' | 'before' | 'after' | 'between'

/** Primitive values a set filter can match against. */
export type SetFilterValue = string | number | boolean | null

/**
 * One column's filter. The discriminated `kind` drives both the
 * predicate and the editor UI. Fully JSON-serializable.
 */
export type ColumnFilter =
    | { kind: 'text'; op: TextFilterOp; value: string }
    | { kind: 'number'; op: NumberFilterOp; value?: number; to?: number }
    | { kind: 'date'; op: DateFilterOp; value?: string; to?: string }
    | { kind: 'set'; values: SetFilterValue[] }
    | { kind: 'boolean'; value: boolean }

/**
 * Serializable filter model.
 * Drives state persistence and server-side row model requests.
 */
export interface FilterModel {
    /** Quick-filter query matched against all visible columns. */
    quick: string
    /** Per-column filters, keyed by column id. */
    columns: Record<string, ColumnFilter>
}

export type FilterType = ColumnFilter['kind']

/**
 * Advanced per-column filter configuration.
 */
export interface ColumnFilterDef<TRow> {
    /** Editor UI and default predicate family. */
    type: FilterType
    /**
     * Custom predicate overriding the built-in one. Receives the cell
     * value, the raw row and the active filter.
     */
    predicate?: (value: unknown, row: TRow, filter: ColumnFilter) => boolean
}

/**
 * The unit of the row pipeline after node building.
 * Wraps a raw row with identity and position; grouping and tree phases
 * extend this with depth, group info and expansion state.
 */
/**
 * Structural metadata attached to a pipeline node by row-structure
 * features (grouping, tree data, master/detail, expandable rows).
 * Drives treegrid ARIA, first-column indent, the expand toggle and
 * full-width rendering. Absent on plain flat rows.
 */
export interface RowMeta {
    /** Treegrid depth, 0-based. Drives `aria-level` and indent. */
    level?: number
    /** Renders the expand/collapse toggle and `aria-expanded`. */
    expandable?: boolean
    /**
     * Full-width row: a single cell spanning every column, rendered
     * through the `fullWidthRow` snippet instead of column cells.
     */
    fullWidth?: boolean
    /** `aria-setsize` — number of siblings at this level. */
    setSize?: number
    /** `aria-posinset` — 1-based position among siblings. */
    posInSet?: number
}

export interface RowNode<TRow> {
    /** Stable id from `getRowId`. Render key and selection/edit identity. */
    id: string
    /** The raw row object. */
    row: TRow
    /** Index of the row in the original data array. */
    index: number
    /** Structural metadata set by row-structure pipeline stages. */
    meta?: RowMeta
}

export type RowPinSide = 'top' | 'bottom'

export type ColumnAlign = 'left' | 'center' | 'right'

export type PinnedSide = 'left' | 'right'

/**
 * Id of the synthetic checkbox column prepended by the selection
 * feature. Excluded from reorder, pin, hide and state snapshots.
 */
export const SELECTION_COLUMN_ID = '__dg-select__'

export type SelectionMode = 'single' | 'multiple'

/**
 * Serializable snapshot of the runtime column state — order, width,
 * visibility and pin overrides. Round-trips through
 * `getColumnState()` / `applyColumnState()`.
 */
export interface ColumnStateSnapshot {
    /** Leaf column ids in display order. */
    order: string[]
    /** Width overrides in pixels, keyed by column id. */
    widths: Record<string, number>
    /** Visibility overrides, keyed by column id. */
    hidden: Record<string, boolean>
    /** Pin overrides, keyed by column id. */
    pinned: Record<string, PinnedSide | null>
}

/**
 * One rendered cell of a header group row.
 */
export interface HeaderGroupCell {
    /** Group id, or a synthesized id for placeholder cells. */
    id: string
    /** Group label. Empty for placeholders. */
    header: string
    /** Zero-based index of the first spanned leaf within visible columns. */
    start: number
    /** Number of spanned leaf columns. */
    span: number
    /** True for the empty filler above ungrouped columns. */
    isPlaceholder: boolean
    /** Ids of the spanned leaf columns (group resize distributes over these). */
    leafIds: string[]
    /** Pin side shared by the spanned leaves, if any. */
    pinned: PinnedSide | null
}

export type Density = 'compact' | 'standard' | 'comfortable'

/**
 * Strings used by the aria-live announcer. Override via
 * `DataGridOptions.locale` for i18n.
 */
export interface DataGridLocale {
    /** Announced when a column becomes sorted. */
    sorted: (column: string, direction: SortDirection) => string
    /** Announced when sorting is cleared. */
    sortCleared: () => string
    /** Announced with the post-filter row count when the filter changes. */
    filtered: (count: number) => string
    /** Announced when the page changes. */
    page: (page: number) => string
    /** Announced when a column is resized. */
    columnResized: (column: string, width: number) => string
    /** Announced when a column is moved. */
    columnMoved: (column: string, position: number) => string
    /** Announced when a column is pinned or unpinned. */
    columnPinned: (column: string, side: PinnedSide | null) => string
    /** Announced when a column is hidden or shown. */
    columnVisibility: (column: string, hidden: boolean) => string
    /** Announced with the selected row count when the selection changes. */
    selected: (count: number) => string
    /** Announced after rows are copied to the clipboard. */
    copied: (count: number) => string
    /** Announced when a row is expanded or collapsed. */
    rowExpanded: (expanded: boolean) => string
    /** Announced when a row is pinned or unpinned. */
    rowPinned: (side: RowPinSide | null) => string
}

/**
 * Context passed to a custom cell snippet.
 */
export interface DataGridCellContext<TRow> {
    /** The pipeline node the cell belongs to. */
    node: RowNode<TRow>
    /** The raw row object. */
    row: TRow
    /** The resolved cell value (from `accessor` or `row[id]`). */
    value: unknown
    /**
     * Zero-based position of the row within the filtered/sorted set.
     * Window offsets (page, virtual range) are already applied, so the value
     * is stable while scrolling or paging.
     */
    rowIndex: number
}

export interface ColumnDef<TRow> {
    /**
     * Unique column identifier.
     * Also used as the row property key when `accessor` is omitted.
     */
    id: string

    /**
     * Header label text.
     * @default the column `id`
     */
    header?: string

    /**
     * Extracts the cell value from a row.
     * @default (row) => row[id]
     */
    accessor?: (row: TRow) => unknown

    /**
     * Fixed column width in pixels. Takes precedence over `flex`.
     */
    width?: number

    /**
     * Flex weight distributing the remaining viewport width.
     * @default 1 when `width` is omitted
     */
    flex?: number

    /**
     * Minimum column width in pixels.
     * @default 40
     */
    minWidth?: number

    /**
     * Maximum column width in pixels. Applied to fixed widths.
     */
    maxWidth?: number

    /**
     * Horizontal alignment of header and cell content.
     * @default 'left'
     */
    align?: ColumnAlign

    /**
     * Hides the column from rendering while keeping it in the model.
     * @default false
     */
    hidden?: boolean

    /**
     * Pins the column to the left or right edge of the viewport.
     */
    pinned?: PinnedSide

    /**
     * Child columns. Turns this definition into a header group: only
     * `id` and `header` apply to the group itself; all data-facing
     * options belong to the leaf children. Nesting is unlimited.
     */
    children?: ColumnDef<TRow>[]

    /**
     * Enables click-to-sort on the header.
     * @default false
     */
    sortable?: boolean

    /**
     * Custom comparator overriding the default value comparison.
     * The sort direction factor is applied on top of the result.
     */
    sortFn?: (a: TRow, b: TRow) => number

    /**
     * Column filter: a built-in filter type, an advanced definition
     * with a custom predicate, or `false` to disable filtering.
     */
    filter?: FilterType | ColumnFilterDef<TRow> | false

    /**
     * Custom cell renderer.
     */
    cell?: Snippet<[DataGridCellContext<TRow>]>
}

/**
 * Runtime state of a column, derived from its definition.
 * Mutable aspects (order, live width, visibility, pin side) migrate here
 * in the columns-UX phase.
 */
export interface ColumnState<TRow> {
    /** The column id, mirrored from the definition. */
    id: string
    /** The user-provided definition backing this column. */
    def: ColumnDef<TRow>
    /** Resolved header label. */
    header: string
    /** Fixed width in pixels, when defined. */
    width?: number
    /** Flex weight, when no fixed width is defined. */
    flex?: number
    /** Resolved minimum width in pixels. */
    minWidth: number
    /** Maximum width in pixels, when defined. */
    maxWidth?: number
    /** Resolved visibility. */
    hidden: boolean
    /** Resolved alignment. */
    align: ColumnAlign
    /** Resolved pin side. */
    pinned: PinnedSide | null
    /** CSS custom property holding this column's track size. */
    cssVar: string
    /** CSS custom property holding this column's sticky pin offset. */
    pinVar: string
}

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
 * Context handed to feature menu-item factories.
 */
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
}

/**
 * Typed event map of the grid event bus.
 * Features and later phases extend this surface.
 */
export interface GridEventMap {
    sortChanged: { sort: SortState[] }
    filterChanged: { filter: FilterModel }
    pageChanged: { page: number; pageSize: number | null }
    columnResized: { columnId: string; width: number }
    columnMoved: { columnId: string; toIndex: number }
    columnPinned: { columnId: string; side: PinnedSide | null }
    columnVisibilityChanged: { columnId: string; hidden: boolean }
    selectionChanged: { selectedIds: string[] }
    rowsCopied: { count: number }
    rowExpanded: { id: string; expanded: boolean }
    rowPinnedChanged: { id: string; side: RowPinSide | null }
}

export interface DataGridOptions<TRow> {
    /** Column definitions. */
    columns: ColumnDef<TRow>[]

    /** The rows to display (client row model). */
    data?: TRow[]

    /**
     * Returns a stable unique id for a row.
     * Required: selection, editing and keyed rendering need identity.
     */
    getRowId: (row: TRow) => string

    /** Feature modules to register. Order does not matter. */
    features?: GridFeature<TRow>[]

    /**
     * Row density. Drives row height and cell padding via CSS variables.
     * @default 'standard'
     */
    density?: Density

    /** Announcer string overrides for i18n. */
    locale?: Partial<DataGridLocale>
}
