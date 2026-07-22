import type { ColumnDef, RowNode } from '../../core/types.js'
import { getCellValue, isNullish } from '../../core/utils/value.js'

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
            return !isNullish(value) && String(value).toLowerCase().includes(normalized)
        })
    )
}
