import { type CellValuePurpose, type ColumnDef } from '../../core/types/index.js'
import type { MaskKind } from './masks.js'

/** What a rule is asked about before it decides. */
export interface PolicyContext<TRow> {
    /**
     * The row the value came from, or `null` where the purpose has no single
     * row - the list a set filter offers, for one.
     */
    row: TRow | null
    columnId: string
    purpose: CellValuePurpose
}

export interface PolicyRule<TRow> {
    /** Column ids this rule covers. */
    columns: string[]

    /**
     * How the value is replaced. A string picks a built-in; a function gets the
     * value and its context and may return anything the column can draw.
     *
     * `hide` returns `null` rather than an empty string, so a number column
     * draws nothing instead of a zero.
     */
    mask: MaskKind | ((value: unknown, context: PolicyContext<TRow>) => unknown)

    /**
     * When the rule applies, asked per cell. Omit for always.
     *
     * @default undefined
     */
    when?: (context: PolicyContext<TRow>) => boolean

    /**
     * The ways out of the grid this rule covers. Every one, unless you say
     * otherwise - and saying otherwise is how a value ends up masked on screen
     * and plain in the CSV, so it should read like the decision it is.
     *
     * @default every purpose
     */
    purposes?: CellValuePurpose[]
}

export interface PolicyOptions<TRow> {
    rules: PolicyRule<TRow>[]

    /**
     * Warn when a masked column is left sortable or filterable by the grid's
     * own sort and column filters, which read the real value - a hidden number
     * is still rankable, and still findable by narrowing a filter.
     *
     * @default true
     */
    warnOnOpenDoors?: boolean

    /** Columns the policy never touches, whatever the rules say. */
    except?: (column: ColumnDef<TRow>) => boolean
}
