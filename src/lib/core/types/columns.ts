import type { StandardSchemaV1 } from '@standard-schema/spec'
import type { Snippet } from 'svelte'
import type { ClassNameValue } from 'tailwind-merge'
import type { BadgeProps } from 'sv5ui'
import type { ColumnEditorDef, Editable, EditorType } from './editing.js'
import type { ColumnFilterDef, FilterType } from './filtering.js'
import type { RowNode } from './rows.js'

/** Columns: what an app declares and what the model resolves it into. */

export type ColumnAlign = 'left' | 'center' | 'right'

/**
 * Built-in cell renderers, selected by `ColumnDef.type` and configured with
 * `typeOptions`. A `cell` snippet always wins over the type.
 */
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

/**
 * Configuration for the renderer named by `ColumnDef.type`. Every field is
 * optional and only the ones belonging to that type are read.
 */
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

/**
 * Id of the synthetic checkbox column prepended by the selection
 * feature. Excluded from reorder, pin, hide and state snapshots.
 */
export const SELECTION_COLUMN_ID = '__dg-select__'

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

/** Context passed to a custom cell snippet. */
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
    /** Unique column identifier. Also used as the row property key when `accessor` is omitted. */
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

    /** Built-in cell renderer to use. Ignored when `cell` is given. */
    type?: ColumnType

    /** Configuration for `type`. */
    typeOptions?: ColumnTypeOptions<TRow>

    /** Custom cell renderer. */
    cell?: Snippet<[DataGridCellContext<TRow>]>

    /**
     * Classes added to this column's cells, per row — the escape hatch for
     * data-driven styling such as marking negative amounts. Runs for every
     * rendered cell of the column, so keep it cheap.
     */
    cellClass?: (ctx: DataGridCellContext<TRow>) => ClassNameValue

    /**
     * How many columns this cell spans, starting here — the covered cells to
     * its right are not rendered. Return 1 (or omit) for a normal cell. A span
     * is clamped so it never crosses a pin boundary. Applies to body rows.
     */
    colSpan?: (ctx: DataGridCellContext<TRow>) => number

    /**
     * Whether cells in this column can be edited. A predicate receives
     * the row, node and value.
     * @default false
     */
    editable?: Editable<TRow>

    /**
     * Inline editor: a built-in editor type or an advanced definition
     * with options / a custom snippet. Defaults to `'text'` when the
     * column is editable and no editor is set.
     */
    editor?: EditorType | ColumnEditorDef<TRow>

    /**
     * Standard-schema (zod / valibot / arktype / …) validating a
     * committed value. Invalid commits are blocked with an error.
     */
    schema?: StandardSchemaV1

    /**
     * Imperative validator, an alternative to `schema`. Returns an error
     * message, or null when valid.
     */
    validate?: (value: unknown, row: TRow) => string | null

    /**
     * Transforms the editor's raw output into the value written to the
     * row (e.g. parse a number). Runs before validation.
     */
    parse?: (input: unknown, row: TRow) => unknown
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
