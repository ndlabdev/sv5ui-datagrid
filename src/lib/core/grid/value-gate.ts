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

export function readCell<TRow>(
    node: RowNode<TRow>,
    def: ColumnDef<TRow>,
    reader?: CellValueReader<TRow>
): unknown {
    const value = getCellValue(node.row, def)
    return reader ? reader(value, node) : value
}

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

export type CellRead<TRow> = (node: RowNode<TRow>, column: ColumnDef<TRow>) => unknown

export function rawRead<TRow>(node: RowNode<TRow>, column: ColumnDef<TRow>): unknown {
    return getCellValue(node.row, column)
}

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
