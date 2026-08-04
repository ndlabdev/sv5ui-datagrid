import type { StandardSchemaV1 } from '@standard-schema/spec'
import type { Snippet } from 'svelte'
import type { ClassNameValue } from 'tailwind-merge'
import type { BadgeProps } from 'sv5ui'
import type { ColumnEditorDef, Editable, EditorType } from './editing.js'
import type { ColumnFilterDef, FilterType } from './filtering.js'
import type { RowNode } from './rows.js'

/** Columns: what an app declares and what the model resolves it into. */

export type ColumnAlign = 'left' | 'center' | 'right'

/** Built-in renderers, selected by `type`. A `cell` snippet wins over them. */
export type ColumnType =
    | 'text'
    | 'number'
    | 'currency'
    | 'percent'
    | 'date'
    | 'datetime'
    | 'boolean'
    | 'badge'
    | 'user'
    | 'progress'
    | 'rating'
    | 'link'
    | 'actions'

/** An entry in an `actions` column's menu. */
export interface RowAction<TRow> {
    label: string
    /** Iconify name, e.g. `lucide:pencil`. */
    icon?: string
    onSelect: (row: TRow) => void
    disabled?: boolean
    /** Renders in the error colour, for delete and similar. */
    destructive?: boolean
}

/** Options for the renderer named by `type`; only its own fields are read. */
export interface ColumnTypeOptions<TRow> {
    /** `number`, `currency`, `percent`, `date`, `datetime` — BCP 47 tag. Defaults to the browser locale. */
    locale?: string

    /** `number`, `currency`, `percent` — passed straight to `Intl.NumberFormat`. */
    numberFormat?: Intl.NumberFormatOptions

    /** `currency` — ISO 4217 code. @default 'USD' */
    currency?: string

    /**
     * `percent` — set when the value is already 0-100 rather than 0-1.
     * @default false
     */
    wholePercent?: boolean

    /** `date`, `datetime` — passed straight to `Intl.DateTimeFormat`. */
    dateFormat?: Intl.DateTimeFormatOptions

    /** `badge` — value to colour, so statuses read at a glance. */
    colors?: Record<string, BadgeColor>

    /** `badge` — colour used for values missing from `colors`. @default 'surface' */
    fallbackColor?: BadgeColor

    /** `user` — avatar image URL. */
    avatar?: (row: TRow) => string | undefined

    /** `user` — secondary line under the name. */
    description?: (row: TRow) => string | undefined

    /** `progress`, `rating` — upper bound. @default 100 for progress, 5 for rating */
    max?: number

    /** `link` — defaults to the cell value. */
    href?: (row: TRow) => string

    /** `link` — anchor target, e.g. `_blank`. */
    target?: string

    /** `actions` — menu entries; return an empty array to render nothing. */
    actions?: (row: TRow) => RowAction<TRow>[]

    /** `boolean` — icons for the two states. */
    trueIcon?: string
    falseIcon?: string

    /** Text shown for null and undefined. @default '—' */
    emptyText?: string
}

/** Badge colours, taken from sv5ui so the two never drift apart. */
export type BadgeColor = NonNullable<BadgeProps['color']>

export type PinnedSide = 'left' | 'right'

/** The selection feature's checkbox column. */
export const SELECTION_COLUMN_ID = '__dg-select__'

/** The row-reorder feature's grip column. */
export const ROW_HANDLE_COLUMN_ID = '__dg-row-handle__'

/** A column the grid added itself: no data, so every data path skips it. */
export function isSyntheticColumn(id: string): boolean {
    return id === SELECTION_COLUMN_ID || id === ROW_HANDLE_COLUMN_ID
}

/** One rendered cell of a header group row. */
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

/** Context passed to a custom header snippet. */
export interface HeaderContext<TRow> {
    /** Runtime state of the column: id, alignment, pin side, width. */
    column: ColumnState<TRow>
    /** The resolved header label, i.e. `header` or the column id. */
    header: string
}

/** Context passed to a custom cell snippet. */
export interface DataGridCellContext<TRow> {
    /** The pipeline node the cell belongs to. */
    node: RowNode<TRow>
    /** The raw row object. */
    row: TRow
    /** The resolved cell value (from `accessor` or `row[id]`). */
    value: unknown
    /** Position within the filtered/sorted set, stable while scrolling. */
    rowIndex: number
}

export interface ColumnDef<TRow> {
    /** Unique column identifier. Also used as the row property key when `accessor` is omitted. */
    id: string

    /**
     * Header label. Plain text, because it is the accessible name and the
     * label every non-visual surface reuses; `headerCell` changes how it is
     * drawn without losing it.
     * @default the column `id`
     */
    header?: string

    /**
     * Draws the header label; the grid renders its own controls around it.
     * `header` stays the accessible name, so keep it meaningful.
     */
    headerCell?: Snippet<[HeaderContext<TRow>]>

    /**
     * Extracts the cell value from a row.
     * @default (row) => row[id]
     */
    accessor?: (row: TRow) => unknown

    /** Fixed column width in pixels. Takes precedence over `flex`. */
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

    /** Maximum column width in pixels. Applied to fixed widths. */
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

    /** Pins the column to the left or right edge of the viewport. */
    pinned?: PinnedSide

    /**
     * Child columns, making this a header group: only `id` and `header` apply
     * to it, the rest belong to the leaves. Nesting is unlimited.
     */
    children?: ColumnDef<TRow>[]

    /**
     * Set false to freeze one column's width.
     * @default true
     */
    resizable?: boolean

    /**
     * Unset, a cell whose text is cut off is titled on hover. `true` always
     * titles it, a function decides the text, `false` turns it off.
     */
    tooltip?: boolean | ((ctx: DataGridCellContext<TRow>) => string | undefined)

    /** App data travelling with the definition; the grid never reads it. */
    meta?: Record<string, unknown>

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
     * The field this column sorts by when that is not what it displays — a
     * name column showing "Ada Lovelace" but ordering by `lastName`. On the
     * client it names the row property; under `rowModel: 'server'` it is what
     * `toSortRequest` sends. `sortFn` wins over it.
     */
    sortField?: string

    /**
     * Column filter: a built-in filter type, an advanced definition
     * with a custom predicate, or `false` to disable filtering.
     */
    filter?: FilterType | ColumnFilterDef<TRow> | false

    /** Built-in cell renderer to use. Ignored when `cell` is given. */
    type?: ColumnType

    /** Configuration for `type`. */
    typeOptions?: ColumnTypeOptions<TRow>

    /** Custom cell renderer. */
    cell?: Snippet<[DataGridCellContext<TRow>]>

    /** Per-row classes for this column. Runs per rendered cell, so keep it cheap. */
    cellClass?: (ctx: DataGridCellContext<TRow>) => ClassNameValue

    /**
     * How many columns this cell spans; the covered cells are not rendered.
     * Clamped so it never crosses a pin boundary. Body rows only.
     */
    colSpan?: (ctx: DataGridCellContext<TRow>) => number

    /**
     * How many rows this cell spans; the covered cells are not rendered. Stops
     * at a full-width row, and holds while scrolling through it. Sized from
     * the rows it covers, so it wants uniform row heights, not `'auto'`.
     * Body rows only.
     */
    rowSpan?: (ctx: DataGridCellContext<TRow>) => number

    /**
     * A predicate receives the row, node and value.
     * @default false
     */
    editable?: Editable<TRow>

    /** A built-in editor type or a definition with options; `'text'` by default. */
    editor?: EditorType | ColumnEditorDef<TRow>

    /** Standard-schema validating a commit; invalid ones are blocked. */
    schema?: StandardSchemaV1

    /** An alternative to `schema`: an error message, or null when valid. */
    validate?: (value: unknown, row: TRow) => string | null

    /** Turns the editor's output into the stored value, before validation. */
    parse?: (input: unknown, row: TRow) => unknown
}

/** Runtime state of a column, derived from its definition. */
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
    /** Resolved resizability. */
    resizable: boolean
    /** CSS custom property holding this column's track size. */
    cssVar: string
    /** CSS custom property holding this column's sticky pin offset. */
    pinVar: string
}
