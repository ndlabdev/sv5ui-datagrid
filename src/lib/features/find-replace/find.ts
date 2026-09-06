import type { CellRead } from '../../core/grid/index.js'
import { type ColumnState, type RowNode } from '../../core/types/index.js'

export interface FindOptions {
    caseSensitive?: boolean

    wholeCell?: boolean
}

export interface Match {
    row: number
    col: number
    rowId: string
    columnId: string
}

function cellText(value: unknown): string | null {
    if (value === null || value === undefined) return null
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? String(value) : value.toISOString()
    }
    return String(value)
}

function matcher(query: string, options: FindOptions): (text: string) => boolean {
    const caseSensitive = options.caseSensitive === true
    const needle = caseSensitive ? query : query.toLowerCase()
    if (options.wholeCell === true) {
        return (text) => (caseSensitive ? text : text.toLowerCase()) === needle
    }
    return (text) => (caseSensitive ? text : text.toLowerCase()).includes(needle)
}

export function findMatches<TRow>(
    nodes: RowNode<TRow>[],
    columns: ColumnState<TRow>[],
    query: string,
    options: FindOptions & {
        /**
         * How a cell is read, and not optional. A find goes through the same
         * gate the cell itself does: a column the grid is masking is one whose
         * values the user is not being shown, and a search that matched one
         * would point at a cell they cannot read and confirm what it says.
         * `rawRead` is the way to say the raw value is what you meant.
         */
        read: CellRead<TRow>
        isDataNode?: (node: RowNode<TRow>) => boolean
    }
): Match[] {
    if (query === '') return []

    const { read, isDataNode = () => true } = options
    const hit = matcher(query, options)
    const targets = columns.map((column, col) => ({ col, id: column.id, def: column.def }))
    const matches: Match[] = []

    for (let row = 0; row < nodes.length; row++) {
        const node = nodes[row]
        if (!node || !isDataNode(node)) continue

        for (const target of targets) {
            const text = cellText(read(node, target.def))
            if (text !== null && hit(text)) {
                matches.push({ row, col: target.col, rowId: node.id, columnId: target.id })
            }
        }
    }
    return matches
}

export function replaceIn(
    value: unknown,
    query: string,
    replacement: string,
    options: FindOptions = {}
): string | null {
    if (query === '') return null
    const text = cellText(value)
    if (text === null || !matcher(query, options)(text)) return null

    if (options.wholeCell === true) return replacement
    if (options.caseSensitive === true) return text.split(query).join(replacement)
    return replaceInsensitive(text, query, replacement)
}

function replaceInsensitive(text: string, query: string, replacement: string): string {
    const lower = text.toLowerCase()
    const needle = query.toLowerCase()

    let out = ''
    let at = 0
    for (;;) {
        const found = lower.indexOf(needle, at)
        if (found === -1) break
        out += text.slice(at, found) + replacement
        at = found + needle.length
    }
    return out + text.slice(at)
}
