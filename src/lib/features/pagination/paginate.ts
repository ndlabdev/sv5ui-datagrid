import type { RowNode } from '../../core/types.js'

export function paginateNodes<TRow>(
    nodes: RowNode<TRow>[],
    page: number,
    pageSize: number | null
): RowNode<TRow>[] {
    if (!pageSize || pageSize <= 0) return nodes

    const start = (page - 1) * pageSize
    return nodes.slice(start, start + pageSize)
}
