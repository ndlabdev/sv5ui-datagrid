import type { RowNode } from '../types.js'

export function buildRowNodes<TRow>(
    data: TRow[],
    getRowId: (row: TRow) => string
): RowNode<TRow>[] {
    return data.map((row, index) => ({ id: getRowId(row), row, index }))
}

/**
 * Indexes nodes by row id. Rebuilt whole by the derived that owns it and never
 * mutated, so a plain Map is the right container.
 */
export function nodesById<TRow>(nodes: RowNode<TRow>[]): ReadonlyMap<string, RowNode<TRow>> {
    return new Map(nodes.map((node) => [node.id, node]))
}

/** Position of each row within the given list, which is not `node.index`. */
export function nodeIndexById<TRow>(nodes: RowNode<TRow>[]): ReadonlyMap<string, number> {
    return new Map(nodes.map((node, index) => [node.id, index]))
}
