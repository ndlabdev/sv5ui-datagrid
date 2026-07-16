import type { Snippet } from 'svelte'
import type { GridState } from './grid.svelte.js'

export type SortDirection = 'asc' | 'desc'

export interface SortState {
    /** The id of the column being sorted. */
    columnId: string
    /** The active sort direction. */
    direction: SortDirection
}

/**
 * Serializable filter model.
 * Drives state persistence and server-side row model requests.
 * Column filters extend this shape in later phases.
 */
export interface FilterModel {
    /** Quick-filter query matched against all visible columns. */
    quick: string
}

/**
 * The unit of the row pipeline after node building.
 * Wraps a raw row with identity and position; grouping and tree phases
 * extend this with depth, group info and expansion state.
 */
export interface RowNode<TRow> {
    /** Stable id from `getRowId`. Render key and selection/edit identity. */
    id: string
    /** The raw row object. */
    row: TRow
    /** Index of the row in the original data array. */
    index: number
}

export type ColumnAlign = 'left' | 'center' | 'right'

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
    /** CSS custom property holding this column's track size. */
    cssVar: string
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
