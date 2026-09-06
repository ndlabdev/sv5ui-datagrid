import type { CellPosition } from '../../core/interaction/index.js'

/**
 * A range is a box over the body, named by the same `{ row, col }` the focus
 * model uses, so the cell the user is on can be handed straight to
 * `selectCellRange`. `section` rides along optional and unread: the body is
 * the only section a range covers.
 */
export interface CellRange {
    top: number
    left: number
    bottom: number
    right: number
}

export function rangeBetween(anchor: CellPosition, focus: CellPosition): CellRange {
    return {
        top: Math.min(anchor.row, focus.row),
        bottom: Math.max(anchor.row, focus.row),
        left: Math.min(anchor.col, focus.col),
        right: Math.max(anchor.col, focus.col)
    }
}

export function containsCell(range: CellRange, row: number, col: number): boolean {
    return row >= range.top && row <= range.bottom && col >= range.left && col <= range.right
}

export function isInAnyRange(ranges: CellRange[], row: number, col: number): boolean {
    for (const range of ranges) {
        if (containsCell(range, row, col)) return true
    }
    return false
}

export function rangeRows(range: CellRange): number {
    return range.bottom - range.top + 1
}

export function rangeCols(range: CellRange): number {
    return range.right - range.left + 1
}

export function rangeSize(range: CellRange): number {
    return rangeRows(range) * rangeCols(range)
}

export function cellsOf(range: CellRange): CellPosition[] {
    const cells: CellPosition[] = []
    for (let row = range.top; row <= range.bottom; row++) {
        for (let col = range.left; col <= range.right; col++) cells.push({ row, col })
    }
    return cells
}

export function boundsOf(ranges: CellRange[]): CellRange | null {
    if (ranges.length === 0) return null
    return ranges.reduce((bounds, range) => ({
        top: Math.min(bounds.top, range.top),
        left: Math.min(bounds.left, range.left),
        bottom: Math.max(bounds.bottom, range.bottom),
        right: Math.max(bounds.right, range.right)
    }))
}

export function clampRange(range: CellRange, maxRow: number, maxCol: number): CellRange | null {
    if (range.top > maxRow || range.left > maxCol) return null
    return {
        top: Math.max(0, range.top),
        left: Math.max(0, range.left),
        bottom: Math.min(maxRow, range.bottom),
        right: Math.min(maxCol, range.right)
    }
}

export function pasteTargets(
    target: CellRange,
    blockRows: number,
    blockCols: number
): { row: number; col: number; blockRow: number; blockCol: number }[] {
    if (blockRows === 0 || blockCols === 0) return []

    const rows = Math.max(rangeRows(target), blockRows)
    const cols = Math.max(rangeCols(target), blockCols)
    const targets: { row: number; col: number; blockRow: number; blockCol: number }[] = []

    for (let rowOffset = 0; rowOffset < rows; rowOffset++) {
        for (let colOffset = 0; colOffset < cols; colOffset++) {
            targets.push({
                row: target.top + rowOffset,
                col: target.left + colOffset,
                blockRow: rowOffset % blockRows,
                blockCol: colOffset % blockCols
            })
        }
    }
    return targets
}

export function parseTsv(text: string): string[][] {
    const normalised = text.replace(/\r\n/g, '\n').replace(/\n+$/, '')
    if (normalised === '') return []
    return normalised.split('\n').map((line) => line.split('\t'))
}
