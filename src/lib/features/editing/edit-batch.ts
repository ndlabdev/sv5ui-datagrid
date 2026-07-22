import type { EditTransaction } from '../../core/types/index.js'

/**
 * Collapses per-cell edits into one transaction per row, preserving the order
 * rows were first touched, so a batch applies and undoes as a single step.
 */
export function groupChangesByRow(
    entries: { rowId: string; columnId: string; value: unknown }[]
): EditTransaction[] {
    const byRow = new Map<string, Record<string, unknown>>()
    for (const entry of entries) {
        const changes = byRow.get(entry.rowId)
        if (changes) changes[entry.columnId] = entry.value
        else byRow.set(entry.rowId, { [entry.columnId]: entry.value })
    }
    return [...byRow].map(([rowId, changes]) => ({ rowId, changes }))
}
