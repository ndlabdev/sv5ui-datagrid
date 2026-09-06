import type { ColumnDef, RowNode } from '../../core/types/index.js'
import type { CellRead } from '../../core/grid/index.js'
import { declaresKind, inferKind, kindOf, type FilterKind } from './operators.js'

/** Rows read to work out the kind of a column that declares none. */
const SAMPLE = 50

/**
 * One kind per column, worked out once for a pass.
 *
 * A column that says what it holds is taken at its word. One that says
 * nothing is read: a sample of the rows this pass is filtering, through the
 * same gate, so a masked column is guessed from what the user can see.
 *
 * It lives in a plain module rather than beside the state it serves because
 * the `Map` here is a lookup built and thrown away within one pass, and a
 * `.svelte.ts` file is held to using the reactive one.
 */
export function kindsFor<TRow>(
    nodes: readonly RowNode<TRow>[],
    defs: Map<string, ColumnDef<TRow>>,
    read: CellRead<TRow>
): Map<string, FilterKind> {
    const kinds = new Map<string, FilterKind>()
    const sample = nodes.slice(0, SAMPLE)

    for (const [columnId, def] of defs) {
        kinds.set(
            columnId,
            declaresKind(def) ? kindOf(def) : inferKind(sample.map((node) => read(node, def)))
        )
    }
    return kinds
}
