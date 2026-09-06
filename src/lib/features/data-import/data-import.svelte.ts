import { type GridState } from '../../core/grid/index.js'
import {
    type CellDecoration,
    type ColumnDef,
    type GridFeature,
    type RowNode
} from '../../core/types/index.js'
import { slotClass } from '../../core/theme/index.js'
import { looksLikeHeader, parseDelimited } from './delimited.js'
import { type DuplicateOptions, duplicateProblems, existingKeys, noKeys } from './duplicates.js'
import { emptyIds, idsOf } from './ids.js'
import { type ColumnMapping, guessMapping, rememberMapping, type SourceValue } from './mapping.js'
import {
    problemRows,
    problemsByMessage,
    stageRows,
    type ImportProblem,
    type ProblemKind
} from './stage.js'
import { readXlsx } from './xlsx-read.js'
import type { DataImportOptions, ImportFormat, ImportStep } from './data-import.types.js'

export const DATA_IMPORT = 'dataImport'

export const DEFAULT_MAX_BYTES = 32 * 1024 * 1024

const BY_EXTENSION: Record<string, ImportFormat> = {
    csv: 'csv',
    tsv: 'tsv',
    txt: 'csv',
    xlsx: 'xlsx'
}

export class DataImport<TRow> {
    step = $state<ImportStep>('idle')
    busy = $state(false)
    error = $state<string | null>(null)
    fileName = $state<string | null>(null)

    hasHeader = $state(true)
    headers = $state.raw<string[]>([])
    sheets = $state.raw<string[]>([])
    sheet = $state<string | null>(null)

    mappings = $state.raw<ColumnMapping[]>([])
    staged = $state.raw<TRow[]>([])
    problems = $state.raw<ImportProblem[]>([])

    #grid: GridState<TRow>
    #options: DataImportOptions<TRow>
    #source: SourceValue[][] = []
    #bytes: Uint8Array | null = null
    #staging = false
    #stagedIds: ReadonlySet<string> = emptyIds()

    constructor(grid: GridState<TRow>, options: DataImportOptions<TRow>) {
        this.#grid = grid
        this.#options = options

        grid.events.on('cellEdited', ({ rowId, columnId }) => {
            if (this.#stagedIds.has(rowId)) void this.#recheck(rowId, columnId)
        })
    }

    #indexOf(rowId: string): number {
        return this.staged.findIndex((row) => this.#grid.getRowId(row) === rowId)
    }

    #currentRow(rowId: string): TRow | undefined {
        return this.#grid.data.find((row) => this.#grid.getRowId(row) === rowId)
    }

    async #recheck(rowId: string, columnId: string): Promise<void> {
        const rowIndex = this.#indexOf(rowId)
        const row = this.#currentRow(rowId)
        const column = this.#columns().find((entry) => entry.id === columnId)
        if (rowIndex < 0 || !row || !column) return

        const kept = this.problems.filter(
            (problem) => problem.rowIndex !== rowIndex || problem.columnId !== columnId
        )

        const { problems } = await stageRows([[]], [], [column], {
            messageFor: (kind, entry) => this.#defaultMessage(kind, entry)
        })
        void problems

        const failed = await this.#checkCell(row, column)
        this.staged = this.staged.map((entry, index) => (index === rowIndex ? row : entry))
        const revalidated = failed
            ? [...kept, { rowIndex, columnId, kind: 'invalid' as const, message: failed }]
            : kept
        this.problems = [
            ...revalidated.filter(
                (problem) => problem.kind !== 'duplicate' && problem.kind !== 'existing'
            ),
            ...this.#duplicates(this.staged)
        ]
    }

    async #checkCell(row: TRow, column: ColumnDef<TRow>): Promise<string | null> {
        const value = (row as Record<string, unknown>)[column.id]
        if (column.validate) return column.validate(value, row)
        if (!column.schema) return null

        const result = await column.schema['~standard'].validate(value)
        const issues = result.issues
        return issues && issues.length > 0 ? (issues[0]?.message ?? null) : null
    }

    get accepts(): ImportFormat[] {
        return this.#options.accept ?? ['csv', 'tsv', 'xlsx', 'clipboard']
    }

    get badRows(): Set<number> {
        return problemRows(this.problems)
    }

    get issueCounts(): { message: string; count: number }[] {
        return problemsByMessage(this.problems)
    }

    get validCount(): number {
        return this.staged.length - this.badRows.size
    }

    get sourceCount(): number {
        return Math.max(0, this.#source.length - (this.hasHeader ? 1 : 0))
    }

    get preview(): string[][] {
        const body = this.hasHeader ? this.#source.slice(1) : this.#source
        return body
            .slice(0, 3)
            .map((line) => line.map((cell) => (cell === null ? '' : String(cell))))
    }

    get matchedCount(): number {
        return this.mappings.filter((entry) => entry.sourceIndex !== null).length
    }

    get canReview(): boolean {
        return this.step === 'mapping' && this.mappings.some((entry) => entry.sourceIndex !== null)
    }

    get isReviewing(): boolean {
        return this.step === 'review' && this.staged.length > 0
    }

    #memoryKey(): string | null {
        const asked = this.#options.rememberAs
        if (asked === null) return null
        return asked ?? `dg-import:${this.#grid.columns.all.map((column) => column.id).join(',')}`
    }

    #remembered(): Record<string, string> {
        const key = this.#memoryKey()
        if (!key || typeof localStorage === 'undefined') return {}
        try {
            const stored = localStorage.getItem(key)
            const parsed = stored ? (JSON.parse(stored) as Record<string, unknown>) : {}

            const out: Record<string, string> = {}
            for (const [columnId, header] of Object.entries(parsed)) {
                if (typeof header === 'string') out[columnId] = header
            }
            return out
        } catch {
            return {}
        }
    }

    #remember(): void {
        const key = this.#memoryKey()
        if (!key || typeof localStorage === 'undefined') return
        try {
            localStorage.setItem(key, JSON.stringify(rememberMapping(this.mappings, this.headers)))
        } catch {
            this.error = null
        }
    }

    #columns(): ColumnDef<TRow>[] {
        return this.#grid.columns.all
            .map((column) => column.def)
            .filter((def) => def.type !== 'actions')
    }

    #afterRead(rows: SourceValue[][]): void {
        this.staged = []
        this.problems = []
        const asText = rows.map((line) => line.map((cell) => (cell === null ? '' : String(cell))))
        this.hasHeader = looksLikeHeader(asText)
        this.#source = rows
        this.#applyHeader()
        this.step = 'mapping'
    }

    #applyHeader(): void {
        const first = this.#source[0] ?? []
        this.headers = this.hasHeader
            ? first.map((cell, index) =>
                  cell === null || cell === '' ? `#${index + 1}` : String(cell)
              )
            : first.map((_, index) => `#${index + 1}`)

        this.mappings = guessMapping(this.#columns(), this.headers, this.#remembered())
    }

    setHasHeader = (value: boolean): void => {
        this.back()
        this.hasHeader = value
        this.#applyHeader()
    }

    setMapping = (columnId: string, sourceIndex: number | null): void => {
        this.back()
        this.mappings = this.mappings.map((mapping) =>
            mapping.columnId === columnId
                ? { ...mapping, sourceIndex }
                : mapping.sourceIndex === sourceIndex && sourceIndex !== null
                  ? { ...mapping, sourceIndex: null }
                  : mapping
        )
    }

    #refuseServer(): boolean {
        if (this.#grid.rowModel !== 'server') return false
        this.error = this.#grid.labels.importServerRefusal
        this.step = 'idle'
        return true
    }

    takeText = async (text: string, format: ImportFormat = 'csv'): Promise<void> => {
        if (this.#refuseServer()) return
        this.#restore()
        this.error = null
        this.busy = true
        try {
            const rows = parseDelimited(text, {
                delimiter: format === 'tsv' ? '\t' : undefined,
                maxRows: this.#options.maxRows
            })
            if (rows.length === 0) throw new Error(this.#grid.labels.importEmpty)
            this.#bytes = null
            this.sheets = []
            this.#afterRead(rows)
        } catch (cause) {
            this.error = cause instanceof Error ? cause.message : String(cause)
            this.step = 'idle'
        } finally {
            this.busy = false
        }
    }

    takeBytes = async (bytes: Uint8Array, sheet?: string): Promise<void> => {
        if (this.#refuseServer()) return
        this.#restore()
        this.error = null
        this.busy = true
        try {
            const { rows, sheets } = await readXlsx(bytes, {
                sheet: sheet ?? this.#options.sheet,
                maxRows: this.#options.maxRows
            })
            if (rows.length === 0) throw new Error(this.#grid.labels.importEmpty)
            this.#bytes = bytes
            this.sheets = sheets
            this.sheet = sheet ?? this.#options.sheet ?? sheets[0] ?? null
            this.#afterRead(rows)
        } catch (cause) {
            this.error = cause instanceof Error ? cause.message : String(cause)
            this.step = 'idle'
        } finally {
            this.busy = false
        }
    }

    setSheet = async (name: string): Promise<void> => {
        if (!this.#bytes) return
        await this.takeBytes(this.#bytes, name)
    }

    take = async (file: File): Promise<void> => {
        const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
        const format = BY_EXTENSION[extension]

        if (!format || !this.accepts.includes(format)) {
            this.error = this.#grid.labels.importUnknownFormat(file.name)
            return
        }

        const maxBytes = this.#options.maxBytes ?? DEFAULT_MAX_BYTES
        if (file.size > maxBytes) {
            this.error = this.#grid.labels.importTooBig(file.name, Math.round(maxBytes / 1_048_576))
            return
        }

        this.fileName = file.name

        if (format === 'xlsx') {
            await this.takeBytes(new Uint8Array(await file.arrayBuffer()))
            return
        }
        await this.takeText(await file.text(), format)
    }

    review = async (): Promise<void> => {
        if (!this.canReview) return
        this.busy = true
        this.error = null
        try {
            const body = this.hasHeader ? this.#source.slice(1) : this.#source
            const { rows, problems } = await stageRows(body, this.mappings, this.#columns(), {
                newRow: this.#options.newRow,
                decimal: this.#options.decimal,
                messageFor: (kind, column) =>
                    this.#options.messageFor?.(kind, column) ?? this.#defaultMessage(kind, column)
            })

            this.staged = rows
            this.problems = [...problems, ...this.#duplicates(rows)]
            this.#stagedIds = idsOf(rows, (row) => this.#grid.getRowId(row))
            this.#grid.data = [...this.#grid.data, ...rows]
            this.#staging = true
            this.step = 'review'
            this.#remember()
        } catch (cause) {
            this.error = cause instanceof Error ? cause.message : String(cause)
        } finally {
            this.busy = false
        }
    }

    #dedupe(): DuplicateOptions | null {
        const dedupe = this.#options.dedupe
        if (!dedupe || dedupe.columns.length === 0) return null
        return { columns: dedupe.columns, against: dedupe.against ?? 'both' }
    }

    #duplicates(rows: readonly TRow[]): ImportProblem[] {
        const dedupe = this.#dedupe()
        if (!dedupe) return []

        const t = this.#grid.labels
        const known =
            dedupe.against === 'file'
                ? noKeys()
                : existingKeys(
                      this.#grid.data.filter(
                          (row) => !this.#stagedIds.has(this.#grid.getRowId(row))
                      ),
                      dedupe.columns
                  )

        return duplicateProblems(rows, dedupe, known, {
            inFile: (key) => t.importDuplicate(key),
            inGrid: (key) => t.importExisting(key)
        })
    }

    #defaultMessage(kind: ProblemKind, column: ColumnDef<TRow>): string {
        const t = this.#grid.labels
        const header = String(column.header ?? column.id)
        if (kind === 'number') return t.importNotNumber(header)
        if (kind === 'date') return t.importNotDate(header)
        if (kind === 'boolean') return t.importNotBoolean(header)
        if (kind === 'duplicate') return t.importDuplicate(header)
        if (kind === 'existing') return t.importExisting(header)
        return t.importInvalid(header)
    }

    commit = async (options: { validOnly?: boolean } = {}): Promise<void> => {
        const bad = this.badRows
        const live = this.staged.map((row) => this.#currentRow(this.#grid.getRowId(row)) ?? row)
        const chosen = options.validOnly ? live.filter((_, index) => !bad.has(index)) : live

        if (chosen.length === 0) return

        this.busy = true
        this.error = null
        try {
            this.#restore()
            await this.#options.onCommit(chosen)
            this.cancel()
        } catch (cause) {
            this.error = cause instanceof Error ? cause.message : String(cause)
        } finally {
            this.busy = false
        }
    }

    #restore(): void {
        if (!this.#staging) return

        const staged = this.#stagedIds
        this.#grid.data = this.#grid.data.filter((row) => !staged.has(this.#grid.getRowId(row)))
        this.#staging = false
        this.#stagedIds = emptyIds()
    }

    back = (): void => {
        if (this.step !== 'review') return
        this.#restore()
        this.staged = []
        this.problems = []
        this.step = 'mapping'
    }

    cancel = (): void => {
        this.#restore()
        this.step = 'idle'
        this.staged = []
        this.problems = []
        this.headers = []
        this.mappings = []
        this.sheets = []
        this.sheet = null
        this.fileName = null
        this.error = null
        this.#source = []
        this.#bytes = null
    }

    isStaged = (rowId: string): boolean => this.#stagedIds.has(rowId)

    decoration = (node: RowNode<TRow>, columnId: string): CellDecoration | undefined => {
        if (!this.#stagedIds.has(node.id)) return undefined

        const rowIndex = this.#indexOf(node.id)
        const problem = this.problems.find(
            (entry) => entry.rowIndex === rowIndex && entry.columnId === columnId
        )

        return {
            class: slotClass(problem ? 'importBadCell' : 'importStagedCell')
        }
    }
}

export function getDataImport<TRow>(grid: GridState<TRow>): DataImport<TRow> | undefined {
    return grid.feature<DataImport<TRow>>(DATA_IMPORT)
}

export function dataImport<TRow>(options: DataImportOptions<TRow>): GridFeature<TRow> {
    return {
        id: DATA_IMPORT,
        createState: (grid) => new DataImport<TRow>(grid, options),
        cellDecoration: ({ grid, node, column }) => getDataImport(grid)?.decoration(node, column.id)
    }
}
