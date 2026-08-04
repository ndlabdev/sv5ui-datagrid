import type { EditTransaction } from '../../core/types/index.js'

/** One transaction per row, in the order rows were touched: one undo step. */
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

/**
 * Clipboard text as a cell grid, the inverse of the TSV copy. One trailing
 * newline is dropped: spreadsheets append one to every copy.
 */
export function parseClipboardMatrix(text: string): string[][] {
    const normalized = text.replace(/\r\n?/g, '\n').replace(/\n$/, '')
    if (normalized === '') return []
    return normalized.split('\n').map((line) => line.split('\t'))
}
