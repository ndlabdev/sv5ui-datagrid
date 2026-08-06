import type { RowNode } from '../types/index.js'

export function buildRowNodes<TRow>(
    data: TRow[],
    getRowId: (row: TRow) => string
): RowNode<TRow>[] {
    const nodes = new Array<RowNode<TRow>>(data.length)
    for (let index = 0; index < data.length; index++) {
        nodes[index] = { id: getRowId(data[index]), row: data[index], index }
    }
    return nodes
}

/**
 * Rebuilt whole by the derived that owns it, so a plain Map suffices. Filled
 * by hand rather than from `map`, which would allocate a second array of pairs
 * the size of the data on the way in.
 */
export function nodesById<TRow>(nodes: RowNode<TRow>[]): ReadonlyMap<string, RowNode<TRow>> {
    const index = new Map<string, RowNode<TRow>>()
    for (const node of nodes) index.set(node.id, node)
    return index
}

/** Position of each row within the given list, which is not `node.index`. */
export function nodeIndexById<TRow>(nodes: RowNode<TRow>[]): ReadonlyMap<string, number> {
    const positions = new Map<string, number>()
    for (let i = 0; i < nodes.length; i++) positions.set(nodes[i].id, i)
    return positions
}
