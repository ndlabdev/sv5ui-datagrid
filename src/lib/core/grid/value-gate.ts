import type {
    CellValuePurpose,
    CellValueReader,
    CellValueScope,
    ColumnDef,
    GridFeature,
    RowNode
} from '../types/index.js'
import { getCellValue } from '../utils/value.js'
import type { GridState } from './grid.svelte.js'

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
 * What is cached is the composed reader, not the column. Composing is the
 * expensive half: `readerFor` allocates a scope and asks every registered gate
 * for its reader, and the answer is fixed for the column and the purpose, so a
 * pass that asked per cell would do that work once per cell instead of once
 * per column. Its own docstring says to hoist it out of the row loop; this is
 * that hoist, for the callers whose loop is over cells rather than rows.
 *
 * A column the grid does not know falls through to the raw value rather than
 * to nothing, so a pass over a `ColumnDef` a feature made up itself still
 * reads. The `null` entry is what tells "looked up, not there" from "not
 * looked up yet".
 */
export function gateReader<TRow>(grid: GridState<TRow>, purpose: CellValuePurpose): CellRead<TRow> {
    interface Gate {
        def: ColumnDef<TRow>
        reader: CellValueReader<TRow> | undefined
    }
    const gates = new Map<string, Gate | null>()

    return (node, column) => {
        let gate = gates.get(column.id)
        if (gate === undefined) {
            const state = grid.columns.get(column.id)
            gate = state ? { def: state.def, reader: grid.readerFor(column.id, purpose) } : null
            gates.set(column.id, gate)
        }
        return gate ? readCell(node, gate.def, gate.reader) : getCellValue(node.row, column)
    }
}
