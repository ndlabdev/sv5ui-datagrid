import type { GridState } from '../../core/grid/grid.svelte.js'
import { nodesById } from '../../core/grid/row-node.js'
import { HEADER_ROW } from '../../core/interaction/focus-model.svelte.js'
import {
    SELECTION_COLUMN_ID,
    type GridFeature,
    type Keybinding,
    type RowNode,
    type SelectionMode
} from '../../core/types/index.js'
import { mutator } from '../../core/utils/reactivity.js'
import { downloadCsv, pickColumns, rowsToMatrix, toCsv, toTsv, withHeaderRow } from './clipboard.js'
import {
    allSelection,
    emptySelection,
    selectAllStateOf,
    selectableIdsOf,
    singleSelection,
    withId,
    withoutId,
    withRange
} from './selection-set.js'
import type {
    CopyOptions,
    ExportCsvOptions,
    SelectAllState,
    SelectionOptions,
    ToggleModifiers
} from './selection.types.js'

export const SELECTION = 'selection'

export class Selection<TRow> {
    selectedIds = $state.raw<ReadonlySet<string>>(emptySelection())

    readonly mode: SelectionMode
    readonly checkbox: boolean
    readonly isRowSelectable: (row: TRow) => boolean

    #grid: GridState<TRow>
    #anchorId: string | null = null

    constructor(grid: GridState<TRow>, options: SelectionOptions<TRow>) {
        this.#grid = grid
        this.mode = options.mode ?? 'multiple'
        this.checkbox = options.checkbox ?? true
        this.isRowSelectable = options.isRowSelectable ?? (() => true)
    }

    selectableNodes = $derived.by(() =>
        this.#grid.preWindowNodes.filter(
            (node) => !node.meta?.fullWidth && this.isRowSelectable(node.row)
        )
    )

    // Rebuilt only when the selectable set changes, not when the selection does.
    #selectableIds = $derived.by(() => selectableIdsOf(this.selectableNodes))

    allState: SelectAllState = $derived.by(() =>
        selectAllStateOf(this.selectedIds, this.#selectableIds)
    )

    get count(): number {
        return this.selectedIds.size
    }

    isSelected(id: string): boolean {
        return this.selectedIds.has(id)
    }

    // Selection addresses the rows the user can actually see, so this indexes
    // the post-filter set rather than the grid's unfiltered source map.
    #byId = $derived.by(() => nodesById(this.#grid.preWindowNodes))

    #nodeOf(id: string): RowNode<TRow> | undefined {
        return this.#byId.get(id)
    }

    #selectable(id: string): boolean {
        const node = this.#nodeOf(id)
        return node !== undefined && this.isRowSelectable(node.row)
    }

    #commit(next: ReadonlySet<string>): void {
        this.selectedIds = next
        this.#grid.events.emit('selectionChanged', { selectedIds: [...next] })
    }

    // `mutator` throughout: these read the selected set to amend it and read
    // `selectableNodes`, which reaches the row pipeline. Neither belongs in a
    // caller's dependencies — an effect that selects a row would re-run on its
    // own write. See its doc.
    select = mutator((id: string): void => {
        if (!this.#selectable(id) || this.selectedIds.has(id)) return
        this.#anchorId = id
        this.#commit(this.mode === 'single' ? singleSelection(id) : withId(this.selectedIds, id))
    })

    deselect = mutator((id: string): void => {
        if (!this.selectedIds.has(id)) return
        this.#commit(withoutId(this.selectedIds, id))
    })

    toggle = mutator((id: string): void => {
        if (this.selectedIds.has(id)) {
            this.deselect(id)
        } else {
            this.select(id)
        }
    })

    toggleWithModifiers = mutator((id: string, modifiers: ToggleModifiers = {}): void => {
        if (modifiers.shift && this.mode === 'multiple' && this.#anchorId) {
            this.selectRangeTo(id)
            return
        }
        this.toggle(id)
    })

    selectRangeTo = mutator((id: string): void => {
        if (this.mode === 'single' || !this.#anchorId) {
            this.select(id)
            return
        }
        if (!this.#selectable(id)) return
        const orderedIds = this.selectableNodes.map((node) => node.id)
        this.#commit(withRange(this.selectedIds, orderedIds, this.#anchorId, id))
    })

    selectAll = mutator((): void => {
        if (this.mode === 'single') return
        this.#commit(allSelection(this.selectableNodes.map((node) => node.id)))
    })

    toggleAll = mutator((): void => {
        if (this.allState === 'all') {
            this.clear()
        } else {
            this.selectAll()
        }
    })

    clear = mutator((): void => {
        this.#anchorId = null
        if (this.selectedIds.size === 0) return
        this.#commit(emptySelection())
    })

    selectedNodes = $derived.by(() =>
        this.#grid.preWindowNodes.filter((node) => this.selectedIds.has(node.id))
    )

    getSelectedRows = (): TRow[] => this.selectedNodes.map((node) => node.row)

    copyText = (options: CopyOptions = {}): string | null => {
        const nodes = this.selectedNodes
        if (nodes.length === 0) return null
        const columns = this.#grid.columns.visible
        const matrix = rowsToMatrix(nodes, columns)
        return toTsv(options.headers ? withHeaderRow(matrix, columns) : matrix)
    }

    copySelection = async (options: CopyOptions = {}): Promise<void> => {
        const text = this.copyText(options)
        if (text === null || typeof navigator === 'undefined' || !navigator.clipboard) return
        await navigator.clipboard.writeText(text)
        this.#grid.events.emit('rowsCopied', { count: this.selectedNodes.length })
    }

    exportCsv = (options: ExportCsvOptions<TRow> = {}): void => {
        const selected = this.selectedNodes
        const nodes =
            options.allRows || selected.length === 0 ? this.#grid.preWindowNodes : selected
        if (nodes.length === 0) return
        // Named columns are resolved against every column, not just the visible
        // ones, so a file can carry a key the grid does not show.
        const source = options.columns ? this.#grid.columns.all : this.#grid.columns.visible
        const columns = pickColumns(source, options.columns)
        if (columns.length === 0) return

        const matrix = rowsToMatrix(nodes, columns, options.formatValue)
        const csv = toCsv(
            (options.headers ?? true) ? withHeaderRow(matrix, columns) : matrix,
            options.delimiter
        )
        downloadCsv(csv, options.filename ?? 'export.csv')
    }
}

function activeRowId<TRow>(grid: GridState<TRow>): string | null {
    return grid.preWindowNodes[grid.focus.active.row]?.id ?? null
}

function onBodyRow<TRow>(grid: GridState<TRow>): boolean {
    return grid.focus.active.row >= 0 && getSelection(grid) !== undefined
}

/** The checkbox is out of the tab order, so Space on the cell reaches it. */
function onSelectAllCell<TRow>(grid: GridState<TRow>): boolean {
    if (grid.focus.active.row !== HEADER_ROW) return false
    const column = grid.columns.visible[grid.focus.active.col]
    return column?.id === SELECTION_COLUMN_ID && getSelection(grid) !== undefined
}

function createKeybindings<TRow>(): Keybinding<TRow>[] {
    return [
        {
            key: ' ',
            when: onSelectAllCell,
            handler: (grid) => getSelection(grid)!.toggleAll()
        },
        {
            key: ' ',
            when: onBodyRow,
            handler: (grid) => {
                const id = activeRowId(grid)
                if (id) getSelection(grid)!.toggle(id)
            }
        },
        {
            key: 'Shift+ ',
            when: onBodyRow,
            handler: (grid) => {
                const id = activeRowId(grid)
                if (id) getSelection(grid)!.selectRangeTo(id)
            }
        },
        {
            key: 'Ctrl+a',
            when: (grid) => getSelection(grid) !== undefined,
            handler: (grid) => getSelection(grid)!.selectAll()
        },
        {
            key: 'Ctrl+c',
            when: (grid) => (getSelection(grid)?.count ?? 0) > 0,
            handler: (grid) => {
                void getSelection(grid)!.copySelection()
            }
        }
    ]
}

export function selection<TRow>(options: SelectionOptions<TRow> = {}): GridFeature<TRow> {
    return {
        id: SELECTION,
        createState: (grid) => {
            const state = new Selection(grid, options)
            if (state.checkbox) grid.columns.selectionColumn = true
            return state
        },
        createApi: (grid) => {
            const state = getSelection(grid)!
            return {
                selectRow: state.select,
                deselectRow: state.deselect,
                toggleRow: state.toggle,
                selectAll: state.selectAll,
                clearSelection: state.clear,
                isRowSelected: (id: string) => state.isSelected(id),
                getSelectedRows: state.getSelectedRows,
                copySelection: state.copySelection,
                exportCsv: state.exportCsv
            }
        },
        keybindings: createKeybindings<TRow>()
    }
}

export function getSelection<TRow>(grid: GridState<TRow>): Selection<TRow> | undefined {
    return grid.feature<Selection<TRow>>(SELECTION)
}
