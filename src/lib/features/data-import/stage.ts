import { type ColumnDef } from '../../core/types/index.js'
import { coerce, type DecimalMark, kindOfColumn } from './coerce.js'
import type { ColumnMapping, SourceValue } from './mapping.js'

export type ProblemKind = 'number' | 'date' | 'boolean' | 'invalid' | 'duplicate' | 'existing'

export interface ImportProblem {
    rowIndex: number
    columnId: string
    kind: ProblemKind
    message: string
}

interface StagedRows<TRow> {
    rows: TRow[]
    problems: ImportProblem[]
}

interface StageOptions<TRow> {
    newRow?: (index: number) => Partial<TRow>
    messageFor?: (kind: ProblemKind, column: ColumnDef<TRow>) => string | undefined
    decimal?: DecimalMark
}

interface Checked {
    error: string | null
    value: unknown
}

async function check<TRow>(value: unknown, row: TRow, column: ColumnDef<TRow>): Promise<Checked> {
    if (column.validate) return { error: column.validate(value, row), value }
    if (!column.schema) return { error: null, value }

    const result = await column.schema['~standard'].validate(value)
    const issues = result.issues
    if (issues && issues.length > 0) return { error: issues[0]!.message, value }
    return { error: null, value: (result as { value: unknown }).value }
}

function defaultMessage(kind: ProblemKind, header: string): string {
    if (kind === 'number') return `${header} is not a number`
    if (kind === 'date') return `${header} is not a date`
    if (kind === 'boolean') return `${header} is not a yes or a no`
    if (kind === 'duplicate') return `${header} appears more than once in this file`
    if (kind === 'existing') return `${header} is already in this grid`
    return `${header} is not valid`
}

interface RowContext<TRow> {
    columns: Map<string, ColumnDef<TRow>>
    used: ColumnMapping[]
    options: StageOptions<TRow>
}

function unreadable<TRow>(
    rowIndex: number,
    column: ColumnDef<TRow>,
    kind: ProblemKind,
    options: StageOptions<TRow>
): ImportProblem {
    return {
        rowIndex,
        columnId: column.id,
        kind,
        message:
            options.messageFor?.(kind, column) ??
            defaultMessage(kind, String(column.header ?? column.id))
    }
}

function readCells<TRow>(
    line: SourceValue[],
    rowIndex: number,
    context: RowContext<TRow>
): { row: Record<string, unknown>; problems: ImportProblem[] } {
    const row = { ...(context.options.newRow?.(rowIndex) ?? {}) } as Record<string, unknown>
    const problems: ImportProblem[] = []

    for (const mapping of context.used) {
        const column = context.columns.get(mapping.columnId)
        if (!column) continue

        const at = mapping.sourceIndex!
        if (at >= line.length) continue

        const raw = line[at] ?? null
        const { value, problem } = coerce(raw, kindOfColumn(column), context.options.decimal)

        if (!problem) {
            row[column.id] = value
            continue
        }

        row[column.id] = raw === null ? null : String(raw)
        problems.push(unreadable(rowIndex, column, problem, context.options))
    }

    return { row, problems }
}

async function validateCells<TRow>(
    row: Record<string, unknown>,
    rowIndex: number,
    unreadable: Set<string>,
    context: RowContext<TRow>
): Promise<ImportProblem[]> {
    const problems: ImportProblem[] = []
    const parsed = new Map<string, unknown>()

    for (const mapping of context.used) {
        const column = context.columns.get(mapping.columnId)
        if (!column || (!column.schema && !column.validate)) continue
        if (unreadable.has(column.id)) continue

        const checked = await check(row[column.id], row as TRow, column)
        if (checked.error !== null) {
            problems.push({
                rowIndex,
                columnId: column.id,
                kind: 'invalid',
                message: checked.error
            })
            continue
        }
        parsed.set(column.id, checked.value)
    }

    for (const [columnId, value] of parsed) row[columnId] = value
    return problems
}

export async function stageRows<TRow>(
    source: SourceValue[][],
    mappings: ColumnMapping[],
    columns: ColumnDef<TRow>[],
    options: StageOptions<TRow> = {}
): Promise<StagedRows<TRow>> {
    const context: RowContext<TRow> = {
        columns: new Map(columns.map((column) => [column.id, column])),
        used: mappings.filter((mapping) => mapping.sourceIndex !== null),
        options
    }

    const rows: TRow[] = []
    const problems: ImportProblem[] = []

    for (let rowIndex = 0; rowIndex < source.length; rowIndex++) {
        const read = readCells(source[rowIndex]!, rowIndex, context)
        const unreadable = new Set(read.problems.map((problem) => problem.columnId))

        problems.push(...read.problems)
        problems.push(...(await validateCells(read.row, rowIndex, unreadable, context)))
        rows.push(read.row as TRow)
    }

    return { rows, problems }
}

export function problemRows(problems: ImportProblem[]): Set<number> {
    return new Set(problems.map((problem) => problem.rowIndex))
}

export function problemsByMessage(problems: ImportProblem[]): { message: string; count: number }[] {
    const counts = new Map<string, number>()
    for (const problem of problems) {
        counts.set(problem.message, (counts.get(problem.message) ?? 0) + 1)
    }
    return [...counts.entries()]
        .map(([message, count]) => ({ message, count }))
        .sort((a, b) => b.count - a.count || a.message.localeCompare(b.message))
}
