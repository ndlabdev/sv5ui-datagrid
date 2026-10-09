import { isDataRow, rawRead, type CellRead } from '../../core/grid/index.js'
import { type ColumnState, type RowNode } from '../../core/types/index.js'
import { isBlank, numericOrNull } from '../../core/utils/index.js'
import type { FormatRule, FormatTarget, PivotCrossing } from './conditional-formatting.types.js'

export interface ScaleStats {
    kind: 'scale'
    min: number
    max: number
}

export interface KeyStats {
    kind: 'keys'
    keys: Set<string>
}

export interface ThresholdStats {
    kind: 'threshold'
    value: number | null
}

interface ExpressionStats {
    kind: 'expression'
    cache: Map<string, boolean>
}

export type RuleStats = ScaleStats | KeyStats | ThresholdStats | ExpressionStats | null

export function columnMap<TRow>(
    columns: readonly ColumnState<TRow>[]
): ReadonlyMap<string, ColumnState<TRow>> {
    return new Map(columns.map((column) => [column.id, column]))
}

export interface StatSource<TRow> {
    nodesFor: (target: FormatTarget | undefined) => readonly RowNode<TRow>[]
    columnsFor: (target: FormatTarget | undefined) => readonly ColumnState<TRow>[]
}

interface Reach<TRow> {
    nodes: readonly RowNode<TRow>[]
    columns: readonly ColumnState<TRow>[]
}

const reach = <TRow>(source: StatSource<TRow>, target: FormatTarget | undefined): Reach<TRow> => ({
    nodes: source.nodesFor(target),
    columns: source.columnsFor(target)
})

export interface StatSourceInput<TRow> {
    columns: ReadonlyMap<string, ColumnState<TRow>>
    rows: readonly RowNode<TRow>[]
    gathered?: readonly RowNode<TRow>[]
    measureOf?: (columnId: string) => number | undefined
}

export const aimedAtACrossing = (target: FormatTarget | undefined): target is PivotCrossing =>
    typeof target === 'object' && target !== null

export function statSource<TRow>(input: StatSourceInput<TRow>): StatSource<TRow> {
    const all = [...input.columns.values()]

    return {
        nodesFor: (target) => (aimedAtACrossing(target) ? (input.gathered ?? []) : input.rows),
        columnsFor: (target) => {
            if (target === undefined) return []
            if (typeof target === 'string') {
                const column = input.columns.get(target)
                return column ? [column] : []
            }
            return all.filter((column) => input.measureOf?.(column.id) === target.measure)
        }
    }
}

function eachNumber<TRow>(
    at: Reach<TRow>,
    read: CellRead<TRow>,
    visit: (value: number) => void
): void {
    for (const column of at.columns) {
        for (const node of at.nodes) {
            const value = numericOrNull(read(node, column.def))
            if (value !== null) visit(value)
        }
    }
}

function scaleOf<TRow>(
    at: Reach<TRow>,
    read: CellRead<TRow>,
    rule: { min?: number; max?: number }
): ScaleStats {
    const { min, max } = rule
    if (min !== undefined && max !== undefined) return { kind: 'scale', min, max }

    let low = Infinity
    let high = -Infinity
    eachNumber(at, read, (value) => {
        if (value < low) low = value
        if (value > high) high = value
    })

    return {
        kind: 'scale',
        min: min ?? (Number.isFinite(low) ? low : 0),
        max: max ?? (Number.isFinite(high) ? high : 0)
    }
}

function barScaleOf<TRow>(
    at: Reach<TRow>,
    read: CellRead<TRow>,
    rule: { min?: number; max?: number }
): ScaleStats {
    const scale = scaleOf(at, read, rule)
    return rule.min === undefined && scale.min > 0 ? { ...scale, min: 0 } : scale
}

function keysOf<TRow>(at: Reach<TRow>, read: CellRead<TRow>, unique: boolean): KeyStats {
    const seen = new Map<string, number>()
    for (const column of at.columns) {
        for (const node of at.nodes) {
            const value = read(node, column.def)
            if (isBlank(value)) continue
            const key = String(value)
            seen.set(key, (seen.get(key) ?? 0) + 1)
        }
    }
    const keys = new Set<string>()
    for (const [key, count] of seen) {
        if (unique ? count === 1 : count > 1) keys.add(key)
    }
    return { kind: 'keys', keys }
}

function thresholdOf<TRow>(
    at: Reach<TRow>,
    read: CellRead<TRow>,
    rule: { n?: number; bottom?: boolean }
): ThresholdStats {
    const n = rule.n ?? 10
    const bottom = rule.bottom === true
    if (n <= 0) return { kind: 'threshold', value: null }

    const best: number[] = []
    const outranks = (candidate: number, held: number) =>
        bottom ? candidate < held : candidate > held

    eachNumber(at, read, (value) => {
        if (best.length === n && !outranks(value, best[n - 1]!)) return

        let at = best.length
        while (at > 0 && outranks(value, best[at - 1]!)) at--
        best.splice(at, 0, value)
        if (best.length > n) best.pop()
    })

    return { kind: 'threshold', value: best.at(-1) ?? null }
}

export function computeStats<TRow>(
    rules: readonly FormatRule[],
    source: StatSource<TRow>,
    read: CellRead<TRow> = rawRead
): RuleStats[] {
    return rules.map((rule): RuleStats => {
        switch (rule.kind) {
            case 'colorScale':
                return scaleOf(reach(source, rule.column), read, rule)
            case 'dataBar':
                return barScaleOf(reach(source, rule.column), read, rule)
            case 'duplicates':
                return keysOf(reach(source, rule.column), read, rule.unique === true)
            case 'topN':
                return thresholdOf(reach(source, rule.column), read, rule)
            case 'expression':
                return { kind: 'expression', cache: new Map<string, boolean>() }
        }
    })
}

export const NUMERIC_KINDS: readonly FormatRule['kind'][] = ['colorScale', 'dataBar', 'topN']

export function hasNumbers<TRow>(
    nodes: readonly RowNode<TRow>[],
    column: ColumnState<TRow> | undefined,
    read: CellRead<TRow> = rawRead,
    sample = 50
): boolean {
    if (!column) return false

    const limit = Math.min(sample, nodes.length)
    for (let index = 0; index < limit; index++) {
        if (numericOrNull(read(nodes[index]!, column.def)) !== null) return true
    }
    return false
}

export function sampleDataRows<TRow>(
    nodes: readonly RowNode<TRow>[],
    limit: number
): RowNode<TRow>[] {
    const sampled: RowNode<TRow>[] = []
    for (const node of nodes) {
        if (!isDataRow(node)) continue
        sampled.push(node)
        if (sampled.length === limit) break
    }
    return sampled
}

export function dataRowsOf<TRow>(
    nodes: readonly RowNode<TRow>[],
    isData: (node: RowNode<TRow>) => boolean
): RowNode<TRow>[] {
    const rows: RowNode<TRow>[] = []
    for (const node of nodes) if (isData(node)) rows.push(node)
    return rows
}
