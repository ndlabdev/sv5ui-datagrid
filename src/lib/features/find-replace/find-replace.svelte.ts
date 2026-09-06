import { type CellRead, gateReader, type GridState, isDataRow } from '../../core/grid/index.js'
import {
    type CellDecoration,
    type EditTransaction,
    type GridFeature
} from '../../core/types/index.js'
import { getPagination } from '../../features/pagination/index.js'
import { slotClass } from '../../core/theme/index.js'
import { findMatches, type Match, replaceIn } from './find.js'
import type { FindReplaceOptions } from './find-replace.types.js'

export const FIND_REPLACE = 'findReplace'

export class FindReplace<TRow> {
    open = $state(false)
    query = $state('')
    replacement = $state('')
    caseSensitive = $state(false)
    wholeCell = $state(false)

    current = $state(-1)

    replaced = $state<number | null>(null)

    readonly replace: boolean
    readonly hotkeys: boolean
    readonly serverReplace: boolean

    #grid: GridState<TRow>
    #gate: CellRead<TRow>
    #matchClass = $derived(slotClass('findMatch'))
    #currentClass = $derived(slotClass('findMatchCurrent'))

    constructor(grid: GridState<TRow>, options: FindReplaceOptions) {
        this.#grid = grid
        this.#gate = gateReader(grid, 'search')
        this.replace = options.replace ?? true
        this.hotkeys = options.hotkeys ?? true
        this.serverReplace = options.serverReplace ?? false
    }

    matches: Match[] = $derived(this.#scan())

    #scan(): Match[] {
        if (!this.open) return []
        return findMatches(this.#grid.preWindowNodes, this.#grid.columns.visible, this.query, {
            read: this.#gate,
            caseSensitive: this.caseSensitive,
            wholeCell: this.wholeCell,
            isDataNode: isDataRow
        })
    }

    get total(): number {
        return this.matches.length
    }

    get partial(): boolean {
        return this.#grid.rowModel === 'server'
    }

    get replaceAvailable(): boolean {
        if (!this.replace) return false
        return !this.partial || this.serverReplace
    }

    #writable(match: Match): boolean {
        const editable = this.#grid.columns.visible[match.col]?.def.editable
        return editable !== undefined && editable !== false
    }

    writableTotal: number = $derived(this.#countWritable())

    #countWritable(): number {
        let count = 0
        for (const match of this.matches) if (this.#writable(match)) count++
        return count
    }

    get canReplaceCurrent(): boolean {
        const match = this.active
        return this.replaceAvailable && match !== null && this.#writable(match)
    }

    get canReplaceAll(): boolean {
        return this.replaceAvailable && this.writableTotal > 0
    }

    get active(): Match | null {
        return this.matches[this.current] ?? null
    }

    show = (): void => {
        this.open = true
        this.replaced = null
    }

    hide = (): void => {
        this.open = false
        this.current = -1
        this.replaced = null
    }

    step = (delta: number): void => {
        const total = this.total
        if (total === 0) {
            this.current = -1
            return
        }

        const from = this.current === -1 ? (delta > 0 ? -1 : 0) : this.current
        this.current = (((from + delta) % total) + total) % total
        this.replaced = null
        this.#reveal(this.matches[this.current]!)
    }

    #reveal(match: Match): void {
        const pagination = getPagination(this.#grid)
        if (pagination?.pageSize) {
            const page = Math.floor(match.row / pagination.pageSize) + 1
            if (page !== pagination.page) pagination.setPage(page)
        }
        this.#grid.api.ensureVisible?.(match.row)
        this.#grid.focus.focusCell({ row: match.row, col: match.col })
    }

    #editsFor(matches: Match[]): EditTransaction[] {
        const byRow: Record<string, Record<string, unknown>> = {}
        for (const match of matches) {
            const node = this.#grid.preWindowNodes[match.row]
            const column = this.#grid.columns.visible[match.col]
            if (!node || !column) continue

            const next = replaceIn(this.#gate(node, column.def), this.query, this.replacement, {
                caseSensitive: this.caseSensitive,
                wholeCell: this.wholeCell
            })
            if (next === null) continue
            ;(byRow[node.id] ??= {})[column.id] = next
        }
        return Object.entries(byRow).map(([rowId, changes]) => ({ rowId, changes }))
    }

    replaceCurrent = (): boolean | Promise<boolean> => {
        const match = this.active
        if (!this.replaceAvailable || !match) return false
        return this.#apply(this.#editsFor([match]))
    }

    replaceAll = (): boolean | Promise<boolean> => {
        if (!this.replaceAvailable) return false
        return this.#apply(this.#editsFor(this.matches))
    }

    #apply(edits: EditTransaction[]): boolean | Promise<boolean> {
        const applyEdits = this.#grid.api.applyEdits
        this.replaced = null
        if (!applyEdits || edits.length === 0) return false

        const cells = edits.reduce((total, edit) => total + Object.keys(edit.changes).length, 0)
        const result = applyEdits(edits)
        if (result instanceof Promise) {
            return result.then((ok) => {
                if (ok) this.replaced = cells
                return ok
            })
        }
        if (result) this.replaced = cells
        return result
    }

    #matchKeys: Record<string, true> = $derived(
        Object.fromEntries(this.matches.map((match) => [`${match.row}:${match.col}`, true]))
    )

    cellDecoration = (row: number, col: number): CellDecoration | undefined => {
        if (!this.open) return undefined

        const active = this.active
        if (active?.row === row && active.col === col) return { class: this.#currentClass }
        return this.#matchKeys[`${row}:${col}`] ? { class: this.#matchClass } : undefined
    }
}

function get<TRow>(grid: GridState<TRow>): FindReplace<TRow> | undefined {
    return grid.feature<FindReplace<TRow>>(FIND_REPLACE)
}

export function findReplace<TRow>(options: FindReplaceOptions = {}): GridFeature<TRow> {
    return {
        id: FIND_REPLACE,
        createState: (grid) => new FindReplace(grid, options),
        createApi: (grid) => {
            const state = get(grid)!
            return {
                openFind: state.show,
                closeFind: state.hide,
                findNext: () => state.step(1),
                findPrevious: () => state.step(-1),
                replaceAllMatches: state.replaceAll
            }
        },
        cellDecoration: ({ grid, rowIndex, colIndex }) =>
            get(grid)?.cellDecoration(rowIndex, colIndex)
    }
}

export function getFindReplace<TRow>(grid: GridState<TRow>): FindReplace<TRow> | undefined {
    return get(grid)
}

declare module '../../core/types/api.js' {
    interface GridApi {
        openFind?: () => void
        closeFind?: () => void
        findNext?: () => void
        findPrevious?: () => void
        replaceAllMatches?: () => boolean | Promise<boolean>
    }
}
