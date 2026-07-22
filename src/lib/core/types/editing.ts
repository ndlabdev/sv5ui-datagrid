import type { Snippet } from 'svelte'
import type { RowNode } from './rows.js'

/** Inline editing: editor selection, its context and the write unit. */

/**
 * Built-in inline editor mapped from a column's `editor`, each backed
 * by a real sv5ui component:
 * text → Input, number → InputNumber, select → Select,
 * selectMenu → SelectMenu (searchable), checkbox → Checkbox,
 * date → DatePicker, time → TimeField, textarea → Textarea,
 * rating → Rating, tags → InputTags.
 */
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

/**
 * Context handed to a custom editor snippet. The snippet reads `value`,
 * pushes changes through `setValue`, and ends the edit with `commit`
 * (validated) or `cancel`.
 */
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

/**
 * A single-row edit: the changed fields keyed by column id.
 * The unit of the transaction and undo/redo APIs.
 */
export interface EditTransaction {
    /** Target row id (from `getRowId`). */
    rowId: string
    /** Column id → new value. */
    changes: Record<string, unknown>
}
