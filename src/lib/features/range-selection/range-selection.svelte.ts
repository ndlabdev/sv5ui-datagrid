import RangeLayer from '../../components/grid/RangeLayer.svelte'
import type { CellPosition } from '../../core/interaction/index.js'
import { type GridState, isDataRow, isLoadingRow } from '../../core/grid/index.js'
import {
    type CellDecoration,
    type EditTransaction,
    type GridFeature,
    type Keybinding,
    SELECTION_COLUMN_ID
} from '../../core/types/index.js'
import { getEditing } from '../../features/editing/index.js'
import { rowsToMatrix, toTsv, withHeaderRow } from '../../features/selection/index.js'
import { slotClass } from '../../core/theme/index.js'
import { numericOrNull } from '../../core/utils/index.js'
import { fillCells, type FillTarget, fillTargetOf } from './fill.js'
import {
    buildMoveEdits,
    buildPasteEdits as buildEdits,
    buildRangeEdits,
    toHtmlTable
} from './range-clipboard.js'
import {
    boundsOf,
    containsCell,
    clampRange,
    isInAnyRange,
    parseTsv,
    rangeBetween,
    rangeCols,
    rangeRows,
    rangeSize,
    type CellRange
} from './range.js'
import type { CopyRangeOptions, RangeSelectionOptions } from './range-selection.types.js'

export interface RangeEdges {
    top: boolean
    bottom: boolean
    start: boolean
    end: boolean
}

export const RANGE_SELECTION = 'rangeSelection'

export class RangeSelection<TRow> {
    ranges = $state.raw<CellRange[]>([])
    dragging = $state(false)

    fillTarget = $state.raw<FillTarget | null>(null)

    #cellClass = $derived(slotClass('rangeCell'))
    #handleClass = $derived(slotClass('fillHandle'))
    #previewClass = $derived(slotClass('fillPreview'))
    #cutClass = $derived(slotClass('cutSource'))
    #moveClass = $derived(slotClass('moveTarget'))
    #edgeClasses = $derived([
        slotClass('rangeEdgeTop'),
        slotClass('rangeEdgeBottom'),
        slotClass('rangeEdgeStart'),
        slotClass('rangeEdgeEnd')
    ])

    readonly multiple: boolean
    readonly paste: boolean
    readonly fill: boolean
    readonly rangeEdit: boolean
    readonly cut: boolean

    #grid: GridState<TRow>
    #anchor: CellPosition | null = null

    #fillSource = $state.raw<CellRange | null>(null)
    cutSource = $state.raw<CellRange | null>(null)
    #cutRowIds: string[] = []
    moveTarget = $state.raw<CellRange | null>(null)
    #grab = $state.raw<CellPosition | null>(null)

    constructor(grid: GridState<TRow>, options: RangeSelectionOptions) {
        this.#grid = grid
        this.multiple = options.multiple ?? true
        this.paste = options.paste ?? true
        this.fill = options.fill ?? true
        this.rangeEdit = options.rangeEdit ?? true
        this.cut = options.cut ?? true
    }

    get maxRow(): number {
        return this.#grid.totalRows - 1
    }

    get maxCol(): number {
        return this.#grid.columns.visible.length - 1
    }

    get primary(): CellRange | null {
        return this.ranges.at(-1) ?? null
    }

    get clampedRanges(): CellRange[] {
        return this.ranges
            .map((range) => clampRange(range, this.maxRow, this.maxCol))
            .filter((range) => range !== null)
    }

    get cellCount(): number {
        return this.clampedRanges.reduce((total, range) => total + rangeSize(range), 0)
    }

    isSelected(row: number, col: number): boolean {
        return isInAnyRange(this.ranges, row, col)
    }

    startRange = (row: number, col: number, options: { additive?: boolean } = {}): void => {
        const cell = { row, col }
        this.#anchor = cell
        const range = rangeBetween(cell, cell)
        this.ranges = options.additive && this.multiple ? [...this.ranges, range] : [range]
        this.dragging = true
    }

    extendTo = (row: number, col: number): void => {
        if (!this.#anchor) return
        const range = rangeBetween(this.#anchor, { row, col })
        this.ranges = [...this.ranges.slice(0, -1), range]
    }

    endRange = (): void => {
        this.dragging = false
    }

    extendBy = (rowDelta: number, colDelta: number): void => {
        const focus = this.#grid.focus.active
        this.#anchor ??= { row: focus.row, col: focus.col }

        const next = {
            row: Math.min(Math.max(focus.row + rowDelta, 0), Math.max(0, this.maxRow)),
            col: Math.min(Math.max(focus.col + colDelta, 0), Math.max(0, this.maxCol))
        }
        this.#grid.focus.focusCell(next)
        const range = rangeBetween(this.#anchor, next)
        this.ranges = this.ranges.length === 0 ? [range] : [...this.ranges.slice(0, -1), range]
    }

    selectAll = (): void => {
        if (this.maxRow < 0 || this.maxCol < 0) return
        this.#anchor = { row: 0, col: 0 }
        this.ranges = [{ top: 0, left: 0, bottom: this.maxRow, right: this.maxCol }]
    }

    clear = (): void => {
        this.#anchor = null
        this.ranges = []
        this.dragging = false
        this.cancelCut()
    }

    getRangeMatrix = (options: CopyRangeOptions = {}): string[][] => {
        const range = this.primary
        const clamped = range ? clampRange(range, this.maxRow, this.maxCol) : null
        if (!clamped) return []

        const nodes = this.#grid.preWindowNodes.slice(clamped.top, clamped.bottom + 1)
        const columns = this.#grid.columns.visible.slice(clamped.left, clamped.right + 1)
        const matrix = rowsToMatrix(nodes, columns, undefined, {
            formatted: options.formatted,
            locale: this.#grid.locale,
            read: (column) => this.#grid.readerFor(column.id, 'clipboard')
        }).map((line, index) => (isLoadingRow(nodes[index]?.row) ? line.map(() => '') : line))
        return options.headers ? withHeaderRow(matrix, columns) : matrix
    }

    getRangeTsv = (options: CopyRangeOptions = {}): string => toTsv(this.getRangeMatrix(options))

    copyRange = async (options: CopyRangeOptions = {}): Promise<boolean> => {
        const matrix = this.getRangeMatrix(options)
        const text = toTsv(matrix)
        if (text === '' || typeof navigator === 'undefined' || !navigator.clipboard) return false

        const html = options.html ?? true
        if (html && typeof ClipboardItem === 'function' && navigator.clipboard.write) {
            const item = new ClipboardItem({
                'text/plain': new Blob([text], { type: 'text/plain' }),
                'text/html': new Blob([toHtmlTable(matrix)], { type: 'text/html' })
            })
            await navigator.clipboard.write([item])
            return true
        }

        await navigator.clipboard.writeText(text)
        return true
    }

    cutRange = (): boolean | Promise<boolean> => {
        if (!this.cut) return false

        const range = this.primary
        const clamped = range ? clampRange(range, this.maxRow, this.maxCol) : null
        if (!clamped) return false

        this.cutSource = clamped
        this.#cutRowIds = this.#rowIdsOf(clamped)
        return this.copyRange()
    }

    cancelCut = (): void => {
        this.cutSource = null
        this.#cutRowIds = []
    }

    #rowIdsOf(range: CellRange): string[] {
        const nodes = this.#grid.preWindowNodes
        const ids: string[] = []
        for (let row = range.top; row <= range.bottom; row++) ids.push(nodes[row]?.id ?? '')
        return ids
    }

    #cutStillPointsAtItsRows(source: CellRange): boolean {
        if (this.#cutRowIds.length === 0) return true

        const now = this.#rowIdsOf(source)
        return (
            now.length === this.#cutRowIds.length &&
            now.every((id, at) => id === this.#cutRowIds[at])
        )
    }

    get moving(): boolean {
        return this.#grab !== null
    }

    moveBorderAt(row: number, col: number): RangeEdges | null {
        if (!this.cut) return null
        const range = this.primary
        const clamped = range ? clampRange(range, this.maxRow, this.maxCol) : null
        if (!clamped || !containsCell(clamped, row, col)) return null

        const edges = {
            top: row === clamped.top,
            bottom: row === clamped.bottom,
            start: col === clamped.left,
            end: col === clamped.right
        }
        return edges.top || edges.bottom || edges.start || edges.end ? edges : null
    }

    startMove = (row: number, col: number): void => {
        const range = this.primary
        const clamped = range ? clampRange(range, this.maxRow, this.maxCol) : null
        if (!this.cut || !clamped || !containsCell(clamped, row, col)) return

        this.cutSource = clamped
        this.#cutRowIds = this.#rowIdsOf(clamped)
        this.moveTarget = clamped
        this.#grab = { row: row - clamped.top, col: col - clamped.left }
    }

    extendMove = (row: number, col: number): void => {
        const source = this.cutSource
        const grab = this.#grab
        if (!source || !grab) return

        const height = source.bottom - source.top
        const width = source.right - source.left
        const top = Math.min(Math.max(row - grab.row, 0), Math.max(0, this.maxRow - height))
        const left = Math.min(Math.max(col - grab.col, 0), Math.max(0, this.maxCol - width))
        this.moveTarget = { top, left, bottom: top + height, right: left + width }
    }

    endMove = (): boolean | Promise<boolean> => {
        const target = this.moveTarget
        const source = this.cutSource
        const grabbed = this.#grab !== null

        this.moveTarget = null
        this.#grab = null
        if (!grabbed || !target || !source) return false

        if (target.top === source.top && target.left === source.left) {
            this.cancelCut()
            return false
        }

        const moved = this.moveRange(target.top, target.left)
        if (moved === false) this.cancelCut()
        return moved
    }

    moveRange = (row: number, col: number): boolean | Promise<boolean> => {
        const source = this.cutSource
        if (!source) return false

        if (!this.#cutStillPointsAtItsRows(source)) {
            this.cancelCut()
            return false
        }

        const applyEdits = this.#grid.api.applyEdits as
            ((edits: EditTransaction[]) => boolean | Promise<boolean>) | undefined
        if (!applyEdits) return false

        const nodes = this.#grid.preWindowNodes
        const columns = this.#grid.columns.visible
        const isData = isDataRow
        const editing = getEditing(this.#grid)

        const isRealCell = (at: number, on: number) => {
            const node = nodes[at]
            const column = columns[on]
            return Boolean(node && column && isData(node) && column.id !== SELECTION_COLUMN_ID)
        }

        const edits = buildMoveEdits(source, row, col, {
            canRead: isRealCell,
            read: (from, at) => {
                const node = nodes[from]
                const column = columns[at]
                return node && column ? this.#grid.getValue(node, column, 'clipboard') : null
            },
            resolve: (at, on) => {
                if (!isRealCell(at, on)) return null

                const node = nodes[at]!
                const column = columns[on]!
                if (editing && !editing.editableAt(node, column.def)) return null
                return { rowId: node.id, columnId: column.id }
            }
        })
        if (edits.length === 0) return false

        this.cancelCut()
        this.ranges = [
            {
                top: row,
                left: col,
                bottom: row + (source.bottom - source.top),
                right: col + (source.right - source.left)
            }
        ]
        this.#anchor = { row, col }
        return applyEdits(edits)
    }

    #pasteColumns(range: CellRange, blockCols: number): number[] {
        const columns = this.#grid.columns.visible
        const inRange: number[] = []
        const beyond: number[] = []

        for (let col = range.left; col < columns.length; col++) {
            if (columns[col]!.id === SELECTION_COLUMN_ID) continue
            if (col <= range.right) inRange.push(col)
            else beyond.push(col)
        }

        if (inRange.length === 0) return []

        const needed = Math.max(inRange.length, blockCols)
        return [...inRange, ...beyond].slice(0, needed)
    }

    buildPasteEdits = (matrix: string[][]): EditTransaction[] => {
        const range = this.primary
        if (!range || matrix.length === 0) return []

        const nodes = this.#grid.preWindowNodes
        const columns = this.#grid.columns.visible
        const isData = isDataRow
        const blockCols = Math.max(...matrix.map((line) => line.length))

        return buildEdits(range, this.#pasteColumns(range, blockCols), matrix, (row, col) => {
            const node = nodes[row]
            const column = columns[col]
            if (!node || !column || !isData(node)) return null
            return { rowId: node.id, columnId: column.id }
        })
    }

    pasteText = (text: string): boolean | Promise<boolean> => {
        if (!this.paste) return false
        const applyEdits = this.#grid.api.applyEdits as
            ((edits: EditTransaction[]) => boolean | Promise<boolean>) | undefined
        if (!applyEdits) return false

        const edits = this.buildPasteEdits(parseTsv(text))
        if (edits.length === 0) return false
        return applyEdits(edits)
    }

    pasteFromClipboard = async (): Promise<boolean> => {
        if (typeof navigator === 'undefined' || !navigator.clipboard?.readText) return false
        return this.pasteText(await navigator.clipboard.readText())
    }

    applyToRange = (value: unknown): boolean | Promise<boolean> => {
        const applyEdits = this.#grid.api.applyEdits as
            ((edits: EditTransaction[]) => boolean | Promise<boolean>) | undefined
        if (!applyEdits) return false

        const nodes = this.#grid.preWindowNodes
        const columns = this.#grid.columns.visible
        const isData = isDataRow

        const edits = buildRangeEdits(this.clampedRanges, value, (row, col) => {
            const node = nodes[row]
            const column = columns[col]
            if (!node || !column || !isData(node)) return null
            return { rowId: node.id, columnId: column.id }
        })
        if (edits.length === 0) return false
        return applyEdits(edits)
    }

    #indexOfCell(rowId: string, columnId: string): CellPosition | null {
        const row = this.#grid.preWindowNodes.findIndex((node) => node.id === rowId)
        const col = this.#grid.columns.visible.findIndex((column) => column.id === columnId)
        return row < 0 || col < 0 ? null : { row, col }
    }

    commitDraftToRange = (): boolean => {
        if (!this.rangeEdit || this.cellCount < 2) return false

        const editing = getEditing(this.#grid)
        const active = editing?.active
        if (!editing || !active || editing.rowEditId !== null) return false

        const cell = this.#indexOfCell(active.rowId, active.columnId)
        if (!cell || !this.isSelected(cell.row, cell.col)) return false

        const value = editing.draft
        editing.cancel()
        void this.applyToRange(value)
        return true
    }

    #anyWritable(range: CellRange): boolean {
        const columns = this.#grid.columns.visible
        for (let col = range.left; col <= range.right; col++) {
            const editable = columns[col]?.def.editable
            if (editable !== undefined && editable !== false) return true
        }
        return false
    }

    get fillHandleAt(): CellPosition | null {
        if (!this.fill || this.dragging) return null
        const range = this.primary
        if (!range || !this.#anyWritable(range)) return null
        return { row: range.bottom, col: range.right }
    }

    get filling(): boolean {
        return this.#fillSource !== null
    }

    startFill = (): void => {
        if (!this.fill) return
        this.#fillSource = this.primary
    }

    extendFill = (row: number, col: number): void => {
        const source = this.#fillSource
        if (!source) return

        const clamped = {
            row: Math.min(Math.max(row, 0), Math.max(0, this.maxRow)),
            col: Math.min(Math.max(col, 0), Math.max(0, this.maxCol))
        }
        const target = fillTargetOf(source, clamped.row, clamped.col)

        this.fillTarget = target && this.#anyWritable(target.range) ? target : null
    }

    endFill = (): boolean | Promise<boolean> => {
        const source = this.#fillSource
        const target = this.fillTarget
        this.#fillSource = null
        this.fillTarget = null
        if (!source || !target) return false

        const applyEdits = this.#grid.api.applyEdits
        if (!applyEdits) return false

        const nodes = this.#grid.preWindowNodes
        const columns = this.#grid.columns.visible
        const isData = isDataRow
        const cells = fillCells(source, target, {
            read: (row, col) => {
                const node = nodes[row]
                const column = columns[col]
                return node && column ? this.#grid.getValue(node, column, 'clipboard') : null
            },
            isDataRow: (row) => {
                const node = nodes[row]
                return node !== undefined && isData(node)
            }
        })

        const byRow: Record<string, Record<string, unknown>> = {}
        for (const cell of cells) {
            const node = nodes[cell.row]
            const column = columns[cell.col]
            if (!node || !column) continue
            ;(byRow[node.id] ??= {})[column.id] = cell.value
        }

        const edits = Object.entries(byRow).map(([rowId, changes]) => ({ rowId, changes }))
        if (edits.length === 0) return false

        this.ranges = [
            ...this.ranges.slice(0, -1),
            {
                top: Math.min(source.top, target.range.top),
                left: Math.min(source.left, target.range.left),
                bottom: Math.max(source.bottom, target.range.bottom),
                right: Math.max(source.right, target.range.right)
            }
        ]
        return applyEdits(edits)
    }

    fillWithin = (axis: 'down' | 'right'): boolean | Promise<boolean> => {
        const range = this.primary
        const clamped = range ? clampRange(range, this.maxRow, this.maxCol) : null
        if (!clamped) return false
        if (axis === 'down' && clamped.bottom === clamped.top) return false
        if (axis === 'right' && clamped.right === clamped.left) return false

        this.#fillSource =
            axis === 'down'
                ? { ...clamped, bottom: clamped.top }
                : { ...clamped, right: clamped.left }
        this.fillTarget = {
            axis,
            range:
                axis === 'down'
                    ? { ...clamped, top: clamped.top + 1 }
                    : { ...clamped, left: clamped.left + 1 }
        }
        return this.endFill()
    }

    #edges(row: number, col: number, inside: (row: number, col: number) => boolean): string {
        const [top, bottom, start, end] = this.#edgeClasses
        let classes = ''
        if (!inside(row - 1, col)) classes += ` ${top}`
        if (!inside(row + 1, col)) classes += ` ${bottom}`
        if (!inside(row, col - 1)) classes += ` ${start}`
        if (!inside(row, col + 1)) classes += ` ${end}`
        return classes
    }

    #boxed(className: string, rect: CellRange, row: number, col: number): CellDecoration {
        const inside = (r: number, c: number) => containsCell(rect, r, c)
        return { class: className + this.#edges(row, col, inside), selected: true }
    }

    #overlay(row: number, col: number): CellDecoration | undefined {
        const fill = this.fillTarget
        if (fill && containsCell(fill.range, row, col)) {
            return this.#boxed(this.#previewClass, fill.range, row, col)
        }

        const move = this.moveTarget
        if (move && containsCell(move, row, col))
            return this.#boxed(this.#moveClass, move, row, col)

        const cut = this.cutSource
        if (cut && containsCell(cut, row, col)) {
            const boxed = this.#boxed(this.#cellClass, cut, row, col)
            return { ...boxed, class: `${boxed.class} ${this.#cutClass}` }
        }
        return undefined
    }

    cellDecoration = (row: number, col: number): CellDecoration | undefined => {
        const overlay = this.#overlay(row, col)
        if (overlay) return overlay
        if (!this.isSelected(row, col)) return undefined

        const inside = (r: number, c: number) => this.isSelected(r, c)
        const base = this.#cellClass + this.#edges(row, col, inside)
        const handle = this.fillHandleAt
        return handle?.row === row && handle.col === col
            ? { class: `${base} ${this.#handleClass}`, selected: true }
            : { class: base, selected: true }
    }

    get selectedValues(): number[] {
        const nodes = this.#grid.preWindowNodes
        const columns = this.#grid.columns.visible
        const values: number[] = []

        for (const range of this.ranges) {
            const clamped = clampRange(range, nodes.length - 1, columns.length - 1)
            if (!clamped) continue

            for (let row = clamped.top; row <= clamped.bottom; row++) {
                const node = nodes[row]
                if (!node) continue

                for (let col = clamped.left; col <= clamped.right; col++) {
                    const column = columns[col]
                    if (!column) continue

                    const value = numericOrNull(this.#grid.getValue(node, column, 'render'))
                    if (value !== null) values.push(value)
                }
            }
        }
        return values
    }

    get bounds(): CellRange | null {
        return boundsOf(this.ranges)
    }

    get shape(): { rows: number; cols: number } | null {
        const range = this.primary
        const clamped = range ? clampRange(range, this.maxRow, this.maxCol) : null
        return clamped ? { rows: rangeRows(clamped), cols: rangeCols(clamped) } : null
    }
}

function hasRange<TRow>(grid: GridState<TRow>): boolean {
    return (getRangeSelection(grid)?.ranges.length ?? 0) > 0
}

function canFill<TRow>(grid: GridState<TRow>): boolean {
    return hasRange(grid) && (getRangeSelection(grid)?.fill ?? false)
}

function createKeybindings<TRow>(): Keybinding<TRow>[] {
    const extend =
        (rowDelta: number, colDelta: number) =>
        (grid: GridState<TRow>): void =>
            getRangeSelection(grid)!.extendBy(rowDelta, colDelta)

    const onBody = (grid: GridState<TRow>) =>
        getRangeSelection(grid) !== undefined && grid.focus.active.row >= 0

    return [
        { key: 'Shift+ArrowDown', when: onBody, handler: extend(1, 0) },
        { key: 'Shift+ArrowUp', when: onBody, handler: extend(-1, 0) },
        { key: 'Shift+ArrowRight', when: onBody, handler: extend(0, 1) },
        { key: 'Shift+ArrowLeft', when: onBody, handler: extend(0, -1) },
        {
            key: 'Escape',
            when: hasRange,
            handler: (grid) => getRangeSelection(grid)!.clear()
        },
        {
            key: 'Ctrl+c',
            when: hasRange,
            handler: (grid) => void getRangeSelection(grid)!.copyRange()
        },
        {
            key: 'Ctrl+x',
            when: (grid) => hasRange(grid) && (getRangeSelection(grid)?.cut ?? false),
            handler: (grid) => void getRangeSelection(grid)!.cutRange()
        },
        {
            key: 'Ctrl+v',
            when: (grid) => hasRange(grid) && getRangeSelection(grid)?.cutSource !== null,
            handler: (grid) => {
                const range = getRangeSelection(grid)!
                const to = range.primary!
                void range.moveRange(to.top, to.left)
            }
        },
        {
            key: 'Ctrl+v',
            when: (grid) => hasRange(grid) && (getRangeSelection(grid)?.paste ?? false),
            handler: (grid) => void getRangeSelection(grid)!.pasteFromClipboard()
        },
        {
            key: 'Ctrl+d',
            when: canFill,
            handler: (grid) => void getRangeSelection(grid)!.fillWithin('down')
        },
        {
            key: 'Ctrl+r',
            when: canFill,
            handler: (grid) => void getRangeSelection(grid)!.fillWithin('right')
        }
    ]
}

export function rangeSelection<TRow>(options: RangeSelectionOptions = {}): GridFeature<TRow> {
    return {
        id: RANGE_SELECTION,
        createState: (grid) => new RangeSelection(grid, options),
        createApi: (grid) => {
            const state = getRangeSelection(grid)!
            return {
                getRanges: () => state.ranges,
                selectCellRange: state.startRange,
                extendCellRange: state.extendTo,
                clearCellRange: state.clear,
                selectAllCells: state.selectAll,
                copyRange: state.copyRange,
                pasteRange: state.pasteFromClipboard,
                getRangeTsv: state.getRangeTsv,
                fillRange: state.fillWithin,
                applyToRange: state.applyToRange,
                cutRange: state.cutRange,
                moveRange: state.moveRange,
                cancelCut: state.cancelCut
            }
        },
        cellDecoration: ({ grid, rowIndex, colIndex }) =>
            getRangeSelection(grid)?.cellDecoration(rowIndex, colIndex),
        component: RangeLayer,
        keybindings: createKeybindings<TRow>()
    }
}

export function getRangeSelection<TRow>(grid: GridState<TRow>): RangeSelection<TRow> | undefined {
    return grid.feature<RangeSelection<TRow>>(RANGE_SELECTION)
}

declare module '../../core/types/api.js' {
    interface GridApi {
        getRanges?: () => CellRange[]
        selectCellRange?: (row: number, col: number, options?: { additive?: boolean }) => void
        extendCellRange?: (row: number, col: number) => void
        clearCellRange?: () => void
        selectAllCells?: () => void
        copyRange?: (options?: CopyRangeOptions) => Promise<boolean>
        pasteRange?: () => Promise<boolean>
        getRangeTsv?: (options?: CopyRangeOptions) => string
        fillRange?: (axis: 'down' | 'right') => boolean | Promise<boolean>
        applyToRange?: (value: unknown) => boolean | Promise<boolean>
        cutRange?: () => boolean | Promise<boolean>
        moveRange?: (row: number, col: number) => boolean | Promise<boolean>
        cancelCut?: () => void
    }
}
