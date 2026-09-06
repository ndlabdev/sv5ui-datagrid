import type {
    CellValuePurpose,
    CellValueReader,
    CellValueScope,
    ColumnDef,
    ColumnState,
    GridFeature,
    RowNode
} from '../types/index.js'
import { getCellValue } from '../utils/value.js'
import type { GridState } from './grid.svelte.js'

/**
 * A cell's value on its way out of the grid.
 *
 * Everything the grid draws, writes or searches reads through here, so a
 * feature standing between the data and the user has one place to stand.
 * `getCellValue` stays the raw accessor underneath, and is what a caller
 * outside this file gets when it deliberately wants the value behind a gate.
 */

/** Reads one cell, through the reader when the column has one. */
export function readCell<TRow>(
    node: RowNode<TRow>,
    def: ColumnDef<TRow>,
    reader?: CellValueReader<TRow>
): unknown {
    const value = getCellValue(node.row, def)
    return reader ? reader(value, node) : value
}

/**
 * The gates of every feature, in registration order, folded into one reader.
 * A later feature sees what the earlier one returned, the way a later
 * `cellDecoration` wins the property an earlier one set.
 */
export function composeReaders<TRow>(
    features: readonly GridFeature<TRow>[],
    scope: CellValueScope<TRow>
): CellValueReader<TRow> | undefined {
    let composed: CellValueReader<TRow> | undefined
    for (const feature of features) {
        const reader = feature.cellValue?.(scope)
        if (!reader) continue
        if (composed === undefined) {
            composed = reader
            continue
        }
        const earlier = composed
        composed = (value, node) => reader(earlier(value, node), node)
    }
    return composed
}

/**
 * A short stable id for a reader, for the two passes that hold their results
 * per column: the quick filter's search text and the set filter's value list.
 *
 * Without it, a grid that swaps a reader — the policy changed, the user
 * changed — answers the next search out of text built for the reader before,
 * which is the value it was meant to stop showing. Identity is the right test
 * because the reader table is derived: a reader stays the same object until
 * something it reads actually changes.
 */
const readerIds = new WeakMap<object, number>()
let lastReaderId = 0

export function readerToken(reader: object | undefined): string {
    if (reader === undefined) return '-'
    let id = readerIds.get(reader)
    if (id === undefined) {
        id = ++lastReaderId
        readerIds.set(reader, id)
    }
    return String(id)
}

/** Reads one cell of one column, however that column has to be read. */
export type CellRead<TRow> = (node: RowNode<TRow>, column: ColumnDef<TRow>) => unknown

/** The raw value, past every gate. For a pass that is the data's own. */
export function rawRead<TRow>(node: RowNode<TRow>, column: ColumnDef<TRow>): unknown {
    return getCellValue(node.row, column)
}

/**
 * A reader for one purpose, for the passes that walk many rows over many
 * columns: aggregation, export, a fill, a find, the statistics behind a colour
 * scale.
 *
 * `grid.getValue` needs the `ColumnState`, and looking that up per cell turns
 * a column scan into a map lookup per cell. Resolving each column once per
 * pass is the whole point of handing back a closure rather than exposing a
 * function that takes the grid: a caller is meant to build one of these, use
 * it for a pass, and drop it.
 *
 * A column the grid does not know falls through to the raw value rather than
 * to nothing, so a pass over a `ColumnDef` a feature made up itself still
 * reads. The `null` in the cache is what tells "looked up, not there" from
 * "not looked up yet".
 */
export function gateReader<TRow>(grid: GridState<TRow>, purpose: CellValuePurpose): CellRead<TRow> {
    const states = new Map<string, ColumnState<TRow> | null>()

    return (node, column) => {
        let state = states.get(column.id)
        if (state === undefined) {
            state = grid.columns.get(column.id) ?? null
            states.set(column.id, state)
        }
        return state ? grid.getValue(node, state, purpose) : getCellValue(node.row, column)
    }
}
