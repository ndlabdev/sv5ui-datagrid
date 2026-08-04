import type { Snippet } from 'svelte'
import type { RowNode } from './rows.js'

/** Inline editing: editor selection, its context and the write unit. */

/** Built-in inline editors, each backed by the sv5ui component of that name. */
export type EditorType =
    | 'text'
    | 'number'
    | 'select'
    | 'selectMenu'
    | 'checkbox'
    | 'date'
    | 'time'
    | 'textarea'
    | 'rating'
    | 'tags'

/** One option of the built-in select editor. */
export interface EditorOption {
    label: string
    value: string
}

/** Handed to a custom editor snippet: read `value`, push through `setValue`. */
export interface EditorContext<TRow> {
    /** Current draft value. */
    value: unknown
    /** The row being edited. */
    row: TRow
    /** The pipeline node being edited. */
    node: RowNode<TRow>
    /** Updates the draft without committing. */
    setValue: (value: unknown) => void
    /** Validates and, if valid, writes the draft to the row. */
    commit: () => void
    /** Discards the draft and leaves edit mode. */
    cancel: () => void
    /** Current validation message, or null. */
    error: string | null
}

/** Advanced editor configuration for a column. */
export interface ColumnEditorDef<TRow> {
    /** Built-in editor family. */
    type: EditorType
    /** Options for the `select` editor. */
    options?: EditorOption[]
    /** Custom editor snippet, overriding the built-in for `type`. */
    editor?: Snippet<[EditorContext<TRow>]>
}

/** Predicate/flag deciding whether a cell can be edited. */
export type Editable<TRow> =
    boolean | ((ctx: { row: TRow; node: RowNode<TRow>; value: unknown }) => boolean)

/** One row's changed fields, keyed by column id. */
export interface EditTransaction {
    /** Target row id (from `getRowId`). */
    rowId: string
    /** Column id → new value. */
    changes: Record<string, unknown>
}
