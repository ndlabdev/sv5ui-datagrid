import { type RowNode } from '../../core/types/index.js'

export const DETAIL_ID_PREFIX = 'detail:'

export function detailNodeId(masterId: string): string {
    return `${DETAIL_ID_PREFIX}${masterId}`
}

export function isDetailNode(id: string): boolean {
    return id.startsWith(DETAIL_ID_PREFIX)
}

export function masterIdOf(detailId: string): string {
    return detailId.slice(DETAIL_ID_PREFIX.length)
}

export interface BuildDetailOptions<TRow> {
    hasDetail: (row: TRow) => boolean

    isExpanded: (id: string) => boolean
}

export function buildDetailNodes<TRow>(
    nodes: RowNode<TRow>[],
    options: BuildDetailOptions<TRow>
): RowNode<TRow>[] {
    const result: RowNode<TRow>[] = []

    for (const node of nodes) {
        const expandable = options.hasDetail(node.row)
        result.push(expandable ? { ...node, meta: { ...node.meta, expandable, level: 0 } } : node)

        if (expandable && options.isExpanded(node.id)) {
            result.push({
                id: detailNodeId(node.id),
                row: node.row,
                index: node.index,
                meta: { ...node.meta, fullWidth: true, level: 1 }
            })
        }
    }

    return result
}
