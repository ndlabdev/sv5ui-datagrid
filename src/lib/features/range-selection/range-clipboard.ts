import { type EditTransaction } from '../../core/types/index.js'
import { type CellRange, containsCell, rangeRows } from './range.js'

type CellRef = { rowId: string; columnId: string } | null

export function buildPasteEdits(
    range: CellRange,
    columnIndices: number[],
    matrix: string[][],
    resolve: (row: number, col: number) => CellRef
): EditTransaction[] {
    if (matrix.length === 0 || columnIndices.length === 0) return []

    const blockRows = matrix.length
    const blockCols = Math.max(...matrix.map((line) => line.length))
    const rows = Math.max(rangeRows(range), blockRows)
    const byRow = new Map<string, Record<string, unknown>>()

    for (let rowOffset = 0; rowOffset < rows; rowOffset++) {
        for (const [colOffset, col] of columnIndices.entries()) {
            const value = matrix[rowOffset % blockRows]?.[colOffset % blockCols]
            if (value === undefined) continue

            const ref = resolve(range.top + rowOffset, col)
            if (!ref) continue

            const changes = byRow.get(ref.rowId)
            if (changes) changes[ref.columnId] = value
            else byRow.set(ref.rowId, { [ref.columnId]: value })
        }
    }

    return [...byRow].map(([rowId, changes]) => ({ rowId, changes }))
}

export function buildRangeEdits(
    ranges: CellRange[],
    value: unknown,
    resolve: (row: number, col: number) => CellRef
): EditTransaction[] {
    const byRow = new Map<string, Record<string, unknown>>()

    for (const range of ranges) {
        for (let row = range.top; row <= range.bottom; row++) {
            for (let col = range.left; col <= range.right; col++) {
                const ref = resolve(row, col)
                if (!ref) continue

                const changes = byRow.get(ref.rowId)
                if (changes) changes[ref.columnId] = value
                else byRow.set(ref.rowId, { [ref.columnId]: value })
            }
        }
    }

    return [...byRow].map(([rowId, changes]) => ({ rowId, changes }))
}

const HTML_ESCAPES: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;'
}

function escapeHtml(text: string): string {
    return text.replace(/[&<>"]/g, (character) => HTML_ESCAPES[character]!)
}

const TEXT_FORMAT = "mso-number-format:'\\@'"

function readsAsFormula(text: string): boolean {
    return /^[=+@]/.test(text) || /^-(?![\d.])/.test(text)
}

export function toHtmlTable(matrix: string[][]): string {
    if (matrix.length === 0) return ''

    const rows = matrix.map((line) => {
        const cells = line.map((cell) => {
            const text = escapeHtml(cell)
            return readsAsFormula(cell)
                ? `<td style="${TEXT_FORMAT}">${text}</td>`
                : `<td>${text}</td>`
        })
        return `<tr>${cells.join('')}</tr>`
    })

    return `<table>${rows.join('')}</table>`
}

interface MovePair {
    from: { row: number; col: number }
    to: { row: number; col: number }
}

export function movePairs(source: CellRange, toRow: number, toCol: number): MovePair[] {
    const pairs: MovePair[] = []
    for (let row = source.top; row <= source.bottom; row++) {
        for (let col = source.left; col <= source.right; col++) {
            pairs.push({
                from: { row, col },
                to: { row: toRow + (row - source.top), col: toCol + (col - source.left) }
            })
        }
    }
    return pairs
}

interface MoveCells {
    canRead: (row: number, col: number) => boolean
    read: (row: number, col: number) => unknown
    resolve: (row: number, col: number) => CellRef
}

export function buildMoveEdits(
    source: CellRange,
    toRow: number,
    toCol: number,
    cells: MoveCells
): EditTransaction[] {
    const { canRead, read, resolve } = cells
    const target: CellRange = {
        top: toRow,
        left: toCol,
        bottom: toRow + (source.bottom - source.top),
        right: toCol + (source.right - source.left)
    }
    const byRow = new Map<string, Record<string, unknown>>()
    const landed: MovePair[] = []

    const write = (ref: { rowId: string; columnId: string }, value: unknown) => {
        const changes = byRow.get(ref.rowId)
        if (changes) changes[ref.columnId] = value
        else byRow.set(ref.rowId, { [ref.columnId]: value })
    }

    for (const pair of movePairs(source, toRow, toCol)) {
        if (!canRead(pair.from.row, pair.from.col)) continue

        const to = resolve(pair.to.row, pair.to.col)
        if (!to) continue

        write(to, read(pair.from.row, pair.from.col))
        landed.push(pair)
    }

    for (const pair of landed) {
        if (containsCell(target, pair.from.row, pair.from.col)) continue

        const origin = resolve(pair.from.row, pair.from.col)
        if (origin) write(origin, null)
    }

    return [...byRow].map(([rowId, changes]) => ({ rowId, changes }))
}
