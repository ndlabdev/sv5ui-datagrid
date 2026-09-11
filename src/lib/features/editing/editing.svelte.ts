import { HEADER_ROW } from '../../core/interaction/index.js'
import type { GridState } from '../../core/grid/index.js'
import { popupOpen, toNumber } from '../../core/utils/index.js'
import { readCell } from '../../core/grid/index.js'
import type {
    ColumnDef,
    ColumnState,
    EditTransaction,
    GridFeature,
    Keybinding,
    RowNode
} from '../../core/types/index.js'
import { groupChangesByRow, parseClipboardMatrix } from './edit-batch.js'
import type { EditingCell, EditingOptions, MoveDirection } from './editing.types.js'
import {
    canRedo,
    canUndo,
    emptyUndo,
    pushCommand,
    redo,
    undo,
    type UndoState
} from './undo-stack.js'
import { isPromise, runValidation, type Validated } from './validate.js'

const EDITING = 'editing'

export class Editing<TRow> {
    active = $state.raw<EditingCell | null>(null)
    rowEditId = $state.raw<string | null>(null)
    draft = $state<unknown>(undefined)
    drafts = $state.raw<Record<string, unknown>>({})
    error = $state<string | null>(null)
    rowErrors = $state.raw<Record<string, string>>({})
    #undo = $state.raw<UndoState>(emptyUndo())

    readonly mode: 'cell' | 'row'
    readonly commitOnBlur: boolean

    #grid: GridState<TRow>

    constructor(grid: GridState<TRow>, options: EditingOptions) {
        this.#grid = grid
        this.mode = options.mode ?? 'cell'
        this.commitOnBlur = options.commitOnBlur ?? true
    }

    get canUndo(): boolean {
        return canUndo(this.#undo)
    }

    get canRedo(): boolean {
        return canRedo(this.#undo)
    }

    editableAt(node: RowNode<TRow>, def: ColumnDef<TRow>): boolean {
        if (node.meta?.fullWidth) return false
        const editable = def.editable
        if (editable === undefined || editable === false) return false

        const reader = this.#grid.readerFor(def.id, 'edit')
        if (reader === undefined) {
            if (editable === true) return true
            return editable({ row: node.row, node, value: readCell(node, def) })
        }

        const value = readCell(node, def)
        if (reader(value, node) !== value) return false
        if (editable === true) return true
        return editable({ row: node.row, node, value })
    }

    isEditing(rowId: string, columnId: string): boolean {
        if (this.active) return this.active.rowId === rowId && this.active.columnId === columnId
        return this.rowEditId === rowId
    }

    #nodeById(rowId: string): RowNode<TRow> | undefined {
        return this.#grid.nodeById(rowId)
    }

    startEdit = (rowId: string, columnId: string): void => {
        const node = this.#nodeById(rowId)
        const def = this.#grid.columns.get(columnId)?.def
        if (!node || !def || !this.editableAt(node, def)) return
        this.active = { rowId, columnId }
        this.rowEditId = null
        this.draft = readCell(node, def, this.#grid.readerFor(def.id, 'edit'))
        this.error = null
    }

    beginEdit = (rowId: string, columnId: string): void => {
        if (this.mode === 'row') this.startRowEdit(rowId)
        else this.startEdit(rowId, columnId)
    }

    startEditWith = (rowId: string, columnId: string, initial: string): void => {
        this.beginEdit(rowId, columnId)
        const column = this.#grid.columns.get(columnId)
        const typed = column && TYPED_EDITORS.has(editorTypeOf(column))
        if (!typed) return
        if (this.rowEditId === rowId) this.setRowDraft(columnId, initial)
        else if (this.active) this.draft = initial
    }

    setDraft = (value: unknown): void => {
        this.draft = value
    }

    setRowDraft = (columnId: string, value: unknown): void => {
        this.drafts = { ...this.drafts, [columnId]: value }
    }

    cancel = (): void => {
        this.active = null
        this.draft = undefined
        this.error = null
    }

    #resolve(
        node: RowNode<TRow>,
        def: ColumnDef<TRow>,
        raw: unknown
    ): Validated | Promise<Validated> {
        const parsed = def.parse ? def.parse(raw, node.row) : parseByType(raw, def)
        return runValidation(parsed, node.row, def)
    }

    #applyTransaction(tx: EditTransaction): EditTransaction {
        const node = this.#nodeById(tx.rowId)
        if (!node) return { rowId: tx.rowId, changes: {} }

        const before: Record<string, unknown> = {}
        const row = node.row as Record<string, unknown>
        for (const key of Object.keys(tx.changes)) before[key] = row[key]

        const data = this.#grid.data.slice()
        data[node.index] = { ...row, ...tx.changes } as TRow
        this.#grid.data = data
        return { rowId: tx.rowId, changes: before }
    }

    #emitCellEdits(applied: EditTransaction, before: EditTransaction): void {
        for (const [columnId, newValue] of Object.entries(applied.changes)) {
            this.#grid.events.emit('cellEdited', {
                rowId: applied.rowId,
                columnId,
                oldValue: before.changes[columnId],
                newValue
            })
        }
    }

    #commitValue(node: RowNode<TRow>, def: ColumnDef<TRow>, validated: Validated): boolean {
        if (validated.error !== null) {
            this.error = validated.error
            this.#grid.announcer.announce(this.#grid.announcerStrings.editInvalid(validated.error))
            return false
        }
        const columnId = def.id
        const after: EditTransaction = {
            rowId: node.id,
            changes: { [columnId]: validated.value }
        }
        const before = this.#applyTransaction(after)
        this.#undo = pushCommand(this.#undo, { before: [before], after: [after] })
        this.#emitCellEdits(after, before)
        this.active = null
        this.draft = undefined
        this.error = null
        return true
    }

    commit = (): boolean | Promise<boolean> => {
        if (!this.active) return false
        const node = this.#nodeById(this.active.rowId)
        const def = this.#grid.columns.get(this.active.columnId)?.def
        if (!node || !def) return false

        const validated = this.#resolve(node, def, this.draft)
        if (isPromise(validated))
            return validated.then((result) => this.#commitValue(node, def, result))
        return this.#commitValue(node, def, validated)
    }

    #pageRows(): { first: number; last: number } | null {
        const pagination = this.#grid.state['pagination'] as
            { page?: number; pageSize?: number | null; server?: boolean } | undefined
        const pageSize = pagination?.pageSize
        if (!pageSize || pagination.server || !pagination.page) return null
        const first = (pagination.page - 1) * pageSize
        return { first, last: first + pageSize - 1 }
    }

    #move(direction: MoveDirection): void {
        const delta = direction === 'down' ? [1, 0] : direction === 'right' ? [0, 1] : [0, -1]
        const active = this.#grid.focus.active
        if (delta[0] !== 0 && (active.section === undefined || active.section === 'body')) {
            const page = this.#pageRows()
            const target = active.row + delta[0]
            if (page && (target < page.first || target > page.last)) return
        }
        this.#grid.focus.moveBy(delta[0], delta[1])
    }

    commitAndMove = (direction: MoveDirection): void => {
        const result = this.commit()
        if (isPromise(result)) {
            void result.then((ok) => {
                if (ok) this.#move(direction)
            })
            return
        }
        if (result) this.#move(direction)
    }

    #editableDefs(): ColumnDef<TRow>[] {
        return this.#grid.columns.visible
            .map((column) => column.def)
            .filter((def) => def.editable !== undefined && def.editable !== false)
    }

    startRowEdit = (rowId: string): void => {
        const node = this.#nodeById(rowId)
        if (!node) return
        const drafts: Record<string, unknown> = {}
        for (const def of this.#editableDefs()) {
            if (this.editableAt(node, def)) {
                drafts[def.id] = readCell(node, def, this.#grid.readerFor(def.id, 'edit'))
            }
        }
        this.rowEditId = rowId
        this.active = null
        this.drafts = drafts
        this.rowErrors = {}
    }

    commitRow = (): boolean | Promise<boolean> => {
        const rowId = this.rowEditId
        if (!rowId) return false
        const node = this.#nodeById(rowId)
        if (!node) return false

        const columns = this.#grid.columns
        const validations = Object.keys(this.drafts).flatMap((columnId) => {
            const def = columns.get(columnId)?.def
            if (!def || !this.editableAt(node, def)) return []
            return [{ columnId, def, result: this.#resolve(node, def, this.drafts[columnId]) }]
        })

        const anyAsync = validations.some((entry) => isPromise(entry.result))
        if (!anyAsync) {
            return this.#commitRowValues(
                node,
                validations.map((entry) => ({
                    columnId: entry.columnId,
                    validated: entry.result as Validated
                }))
            )
        }
        return Promise.all(
            validations.map(async (entry) => ({
                columnId: entry.columnId,
                validated: await entry.result
            }))
        ).then((resolved) => this.#commitRowValues(node, resolved))
    }

    #commitRowValues(
        node: RowNode<TRow>,
        entries: { columnId: string; validated: Validated }[]
    ): boolean {
        const errors: Record<string, string> = {}
        const changes: Record<string, unknown> = {}
        for (const { columnId, validated } of entries) {
            if (validated.error !== null) errors[columnId] = validated.error
            else changes[columnId] = validated.value
        }
        if (Object.keys(errors).length > 0) {
            this.rowErrors = errors
            const [first] = Object.values(errors)
            this.#grid.announcer.announce(this.#grid.announcerStrings.editInvalid(first))
            return false
        }
        const before = this.#applyTransaction({ rowId: node.id, changes })
        this.#undo = pushCommand(this.#undo, {
            before: [before],
            after: [{ rowId: node.id, changes }]
        })
        this.#grid.events.emit('rowEdited', { rowId: node.id, changes })
        this.rowEditId = null
        this.drafts = {}
        this.rowErrors = {}
        return true
    }

    cancelRow = (): void => {
        this.rowEditId = null
        this.drafts = {}
        this.rowErrors = {}
    }

    #replay(transactions: EditTransaction[]): void {
        for (const tx of transactions) {
            const before = this.#applyTransaction(tx)
            this.#emitCellEdits(tx, before)
        }
    }

    undo = (): void => {
        const result = undo(this.#undo)
        if (!result) return
        this.#replay(result.command.before)
        this.#undo = result.state
    }

    redo = (): void => {
        const result = redo(this.#undo)
        if (!result) return
        this.#replay(result.command.after)
        this.#undo = result.state
    }

    applyEdits = (edits: EditTransaction[]): boolean | Promise<boolean> => {
        const resolved = edits.flatMap((edit) => {
            const node = this.#nodeById(edit.rowId)
            if (!node) return []
            return Object.entries(edit.changes).flatMap(([columnId, raw]) => {
                const def = this.#grid.columns.get(columnId)?.def
                if (!def || !this.editableAt(node, def)) return []
                return [{ node, def, columnId, result: this.#resolve(node, def, raw) }]
            })
        })

        if (resolved.some((entry) => isPromise(entry.result))) {
            return Promise.all(
                resolved.map(async (entry) => ({ ...entry, validated: await entry.result }))
            ).then((entries) => this.#writeEdits(entries))
        }
        return this.#writeEdits(
            resolved.map((entry) => ({ ...entry, validated: entry.result as Validated }))
        )
    }

    pasteText = (text: string): boolean | Promise<boolean> => {
        const matrix = parseClipboardMatrix(text)
        const { row, col } = this.#grid.focus.active
        if (matrix.length === 0 || row < 0) return false

        const nodes = this.#grid.preWindowNodes
        const columns = this.#grid.columns.visible
        const edits: EditTransaction[] = []
        for (let r = 0; r < matrix.length; r++) {
            const node = nodes[row + r]
            if (!node) break
            const changes: Record<string, unknown> = {}
            for (let c = 0; c < matrix[r].length; c++) {
                const column = columns[col + c]
                if (column) changes[column.id] = matrix[r][c]
            }
            if (Object.keys(changes).length > 0) edits.push({ rowId: node.id, changes })
        }
        return this.applyEdits(edits)
    }

    #writeEdits(
        entries: {
            node: RowNode<TRow>
            def: ColumnDef<TRow>
            columnId: string
            validated: Validated
        }[]
    ): boolean {
        const invalid = entries.find((entry) => entry.validated.error !== null)
        if (invalid) {
            const message = invalid.validated.error!
            this.error = message
            this.#grid.announcer.announce(this.#grid.announcerStrings.editInvalid(message))
            return false
        }
        if (entries.length === 0) return false

        const after = groupChangesByRow(
            entries.map((entry) => ({
                rowId: entry.node.id,
                columnId: entry.columnId,
                value: entry.validated.value
            }))
        )
        const before = after.map((tx) => this.#applyTransaction(tx))
        this.#undo = pushCommand(this.#undo, { before, after })

        for (let index = 0; index < after.length; index++) {
            this.#emitCellEdits(after[index], before[index])
        }
        return true
    }
}

function activeCell<TRow>(
    grid: GridState<TRow>
): { node: RowNode<TRow>; def: ColumnDef<TRow> } | null {
    const { row, col } = grid.focus.active
    if (row === HEADER_ROW) return null
    const node = grid.preWindowNodes[row]
    const column = grid.columns.visible[col]
    if (!node || !column) return null
    return { node, def: column.def }
}

function canStartEdit<TRow>(grid: GridState<TRow>): boolean {
    const state = getEditing(grid)
    if (!state || state.active || state.rowEditId) return false
    const cell = activeCell(grid)
    return cell !== null && state.editableAt(cell.node, cell.def)
}

function startActive<TRow>(grid: GridState<TRow>): void {
    const cell = activeCell(grid)
    if (cell) getEditing(grid)!.beginEdit(cell.node.id, cell.def.id)
}

function isEditing<TRow>(grid: GridState<TRow>): boolean {
    const state = getEditing(grid)
    return Boolean(state && (state.active || state.rowEditId)) && !popupOpen()
}

function cancelEdit<TRow>(grid: GridState<TRow>): void {
    const state = getEditing(grid)!
    if (state.rowEditId) state.cancelRow()
    else state.cancel()
}

function createKeybindings<TRow>(): Keybinding<TRow>[] {
    return [
        { key: 'Enter', when: canStartEdit, handler: startActive },
        { key: 'F2', when: canStartEdit, handler: startActive },
        { key: 'Escape', when: isEditing, handler: cancelEdit },
        {
            key: 'Ctrl+z',
            when: (grid) => getEditing(grid)?.canUndo ?? false,
            handler: (grid) => getEditing(grid)!.undo()
        },
        {
            key: 'Ctrl+Shift+Z',
            when: (grid) => getEditing(grid)?.canRedo ?? false,
            handler: (grid) => getEditing(grid)!.redo()
        },
        {
            key: 'Ctrl+y',
            when: (grid) => getEditing(grid)?.canRedo ?? false,
            handler: (grid) => getEditing(grid)!.redo()
        }
    ]
}

export function editing<TRow>(options: EditingOptions = {}): GridFeature<TRow> {
    return {
        id: EDITING,
        createState: (grid) => new Editing(grid, options),
        createApi: (grid) => {
            const state = getEditing(grid)!
            return {
                beginEdit: state.beginEdit,
                startEditing: state.startEdit,
                stopEditing: state.cancel,
                getEditingCell: () => state.active,
                startRowEdit: state.startRowEdit,
                commitRow: state.commitRow,
                applyEdits: state.applyEdits,
                pasteText: state.pasteText,
                undo: state.undo,
                redo: state.redo
            }
        },
        keybindings: createKeybindings<TRow>()
    }
}

export function getEditing<TRow>(grid: GridState<TRow>): Editing<TRow> | undefined {
    return grid.feature<Editing<TRow>>(EDITING)
}

function parseByType<TRow>(raw: unknown, def: ColumnDef<TRow>): unknown {
    if (typeof raw !== 'string' || raw.trim() === '') return raw
    if (def.type !== 'number' && def.type !== 'currency' && def.type !== 'percent') return raw
    return toNumber(raw) ?? raw
}

const TYPED_EDITORS = new Set(['text', 'number', 'textarea'])

export function editorTypeOf<TRow>(column: ColumnState<TRow>): string {
    const editor = column.def.editor
    if (editor === undefined) return 'text'
    return typeof editor === 'string' ? editor : editor.type
}

declare module '../../core/types/api.js' {
    interface GridApi {
        beginEdit?: (rowId: string, columnId: string) => void
        startEditing?: (rowId: string, columnId: string) => void
        stopEditing?: () => void
        getEditingCell?: () => EditingCell | null
        startRowEdit?: (rowId: string) => void
        commitRow?: () => boolean | Promise<boolean>
        applyEdits?: (edits: EditTransaction[]) => boolean | Promise<boolean>
        pasteText?: (text: string) => boolean | Promise<boolean>
        undo?: () => void
        redo?: () => void
    }
}
