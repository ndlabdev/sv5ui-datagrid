import type { RowNode } from './types.js'

export function buildRowNodes<TRow>(
    data: TRow[],
    getRowId: (row: TRow) => string
): RowNode<TRow>[] {
    return data.map((row, index) => ({ id: getRowId(row), row, index }))
}
