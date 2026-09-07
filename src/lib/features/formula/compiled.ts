import { gateReader, type GridState, isLoadingRow } from '../../core/grid/index.js'
import { type ColumnState, type RowNode } from '../../core/types/index.js'
import { evaluate, FormulaError, type FormulaValue, isFormulaError } from './evaluate.js'
import type { FormulaColumn } from './formula.types.js'
import { resolveOrder } from './order.js'
import { columnsUsed, type Node, parse } from './parse.js'
import { FormulaSyntaxError } from './tokenize.js'

export interface ParseFailure {
    message: string
    at: number
}

interface Compiled {
    expression: string
    onError: 'code' | 'blank'
    node: Node | null
    error: ParseFailure | null
    dependsOn: string[]
}

export type CompiledMap = ReadonlyMap<string, Compiled>

export const NO_FORMULAS: CompiledMap = new Map<string, Compiled>()

const normalize = (entry: string | FormulaColumn): FormulaColumn =>
    typeof entry === 'string' ? { expression: entry } : entry

function failureOf(error: unknown): ParseFailure {
    if (error instanceof FormulaSyntaxError) return { message: error.message, at: error.at }
    return { message: String(error), at: 0 }
}

function compile(entry: string | FormulaColumn): Compiled {
    const column = normalize(entry)
    const onError = column.onError ?? 'code'

    try {
        const node = parse(column.expression)
        return {
            expression: column.expression,
            onError,
            node,
            error: null,
            dependsOn: columnsUsed(node)
        }
    } catch (error) {
        return {
            expression: column.expression,
            onError,
            node: null,
            error: failureOf(error),
            dependsOn: []
        }
    }
}

export type ReportParseError = (columnId: string, failure: ParseFailure) => void

function compiledAndReported(
    id: string,
    entry: string | FormulaColumn,
    report: ReportParseError
): Compiled {
    const result = compile(entry)
    if (result.error) report(id, result.error)
    return result
}

export function compileAll(
    columns: Record<string, string | FormulaColumn>,
    report: ReportParseError
): CompiledMap {
    const out = new Map<string, Compiled>()
    for (const [id, entry] of Object.entries(columns)) {
        out.set(id, compiledAndReported(id, entry, report))
    }
    return out
}

export function compileExpressions(slice: unknown, report: ReportParseError): CompiledMap | null {
    if (slice === null || typeof slice !== 'object' || Array.isArray(slice)) return null

    const out = new Map<string, Compiled>()
    for (const [id, expression] of Object.entries(slice as Record<string, unknown>)) {
        if (typeof expression !== 'string') continue
        out.set(id, compiledAndReported(id, expression, report))
    }
    return out
}

export function withEntry(
    current: CompiledMap,
    id: string,
    entry: string | FormulaColumn,
    report: ReportParseError
): CompiledMap {
    const next = new Map(current)
    next.set(id, compiledAndReported(id, entry, report))
    return next
}

export function withoutEntry(current: CompiledMap, id: string): CompiledMap {
    if (!current.has(id)) return current
    const next = new Map(current)
    next.delete(id)
    return next
}

export function expressionsOf(current: CompiledMap): Record<string, string> {
    const out: Record<string, string> = {}
    for (const [id, compiled] of current) out[id] = compiled.expression
    return out
}

function shown(value: FormulaValue, onError: 'code' | 'blank'): unknown {
    if (!isFormulaError(value)) return value
    return onError === 'blank' ? null : value.code
}

interface Plan<TRow> {
    compiled: CompiledMap
    columns: ReadonlyMap<string, ColumnState<TRow>>
    order: string[]
    cyclic: Set<string>
    read: (node: RowNode<TRow>, column: ColumnState<TRow>) => unknown
}

function computedFor<TRow>(node: RowNode<TRow>, plan: Plan<TRow>): Record<string, unknown> {
    const { compiled, columns, order, cyclic } = plan
    const computed = new Map<string, unknown>()

    const read = (id: string): unknown => {
        if (computed.has(id)) return computed.get(id)
        const column = columns.get(id)
        return column ? plan.read(node, column) : undefined
    }

    for (const id of cyclic) {
        const onError = compiled.get(id)?.onError ?? 'code'
        computed.set(
            id,
            shown(new FormulaError('#CYCLE', `"${id}" refers back to itself`), onError)
        )
    }

    for (const id of order) {
        const entry = compiled.get(id)!
        const value = entry.node
            ? evaluate(entry.node, { column: read })
            : new FormulaError('#NAME', entry.error?.message ?? 'will not parse')
        computed.set(id, shown(value, entry.onError))
    }

    return Object.fromEntries(computed)
}

export function applyFormulas<TRow>(
    nodes: RowNode<TRow>[],
    compiled: CompiledMap,
    allColumns: readonly ColumnState<TRow>[],
    grid?: GridState<TRow>
): RowNode<TRow>[] {
    if (compiled.size === 0) return nodes

    const dependencies = new Map<string, string[]>()
    for (const [id, entry] of compiled) dependencies.set(id, entry.dependsOn)
    const { order, cyclic } = resolveOrder(dependencies)

    const columns = new Map(allColumns.map((column) => [column.id, column]))

    const gated = grid ? gateReader(grid, 'render') : undefined
    const plan: Plan<TRow> = {
        compiled,
        columns,
        order,
        cyclic,
        read: (node, column) =>
            gated ? gated(node, column.def) : (node.row as Record<string, unknown>)[column.id]
    }

    return nodes.map((node) => {
        if (isLoadingRow(node.row)) return node
        const computed = computedFor(node, plan)
        return { ...node, row: { ...node.row, ...computed } }
    })
}
