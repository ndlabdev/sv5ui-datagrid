import type { ColumnDef, RowNode } from '../../core/types/index.js'
import type { CellRead } from '../../core/grid/index.js'
import { declaresKind, inferKind, kindOf, type FilterKind } from './operators.js'

const SAMPLE = 50

const SCAN = 1_000

export function kindsFor<TRow>(
    nodes: readonly RowNode<TRow>[],
    defs: Map<string, ColumnDef<TRow>>,
    read: CellRead<TRow>
): Map<string, FilterKind> {
    const kinds = new Map<string, FilterKind>()
    const scanned = nodes.slice(0, SCAN)

    for (const [columnId, def] of defs) {
        if (declaresKind(def)) {
            kinds.set(columnId, kindOf(def))
            continue
        }

        const values: unknown[] = []
        for (const node of scanned) {
            const value = read(node, def)
            if (value === null || value === undefined || value === '') continue
            values.push(value)
            if (values.length === SAMPLE) break
        }
        kinds.set(columnId, inferKind(values))
    }
    return kinds
}
