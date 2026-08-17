import type { ColumnDef, RowNode } from '../../core/types/index.js'
import { getCellValue, isBlank } from '../../core/utils/index.js'

export function quickFilterNodes<TRow>(
    nodes: RowNode<TRow>[],
    columns: ColumnDef<TRow>[],
    query: string
): RowNode<TRow>[] {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return nodes

    return nodes.filter((node) =>
        columns.some((column) => {
            const value = getCellValue(node.row, column)
            return !isBlank(value) && String(value).toLowerCase().includes(normalized)
        })
    )
}
