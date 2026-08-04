import type { RowNode } from '../types/index.js'

export function buildRowNodes<TRow>(
    data: TRow[],
    getRowId: (row: TRow) => string
): RowNode<TRow>[] {
    return data.map((row, index) => ({ id: getRowId(row), row, index }))
}

/** Rebuilt whole by the derived that owns it, so a plain Map suffices. */
export function nodesById<TRow>(nodes: RowNode<TRow>[]): ReadonlyMap<string, RowNode<TRow>> {
    return new Map(nodes.map((node) => [node.id, node]))
}

/** Position of each row within the given list, which is not `node.index`. */
export function nodeIndexById<TRow>(nodes: RowNode<TRow>[]): ReadonlyMap<string, number> {
    return new Map(nodes.map((node, index) => [node.id, index]))
}
