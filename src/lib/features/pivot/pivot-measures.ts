import { gateReader, rawRead, type GridState } from '../../core/grid/index.js'
import { numericOrNull } from '../../core/utils/index.js'
import type { ColumnDef, RowNode } from '../../core/types/index.js'
import { aggregate } from '../grouping/aggregate.js'
import type { Aggregation } from '../grouping/grouping.types.js'
import { crossingId, pathId, subtotalId, totalId } from './pivot-ids.js'
import { type Crossing, subtotalPaths } from './pivot-crossing.js'
import { cacheByKey, cacheByRows, partitionByPath, placesOf } from './pivot-rows.js'
import type { PivotMeasure, PivotShowAs } from './pivot.types.js'

const ADDITIVE = new Set(['sum', 'count'])

const ALONG_THE_ROW = new Set<PivotShowAs>([
    'runningTotal',
    'differenceFrom',
    'percentDifferenceFrom',
    'rankInRow'
])

export function share(value: unknown, whole: unknown): unknown {
    const top = numericOrNull(value)
    const bottom = numericOrNull(whole)
    if (top === null || bottom === null || bottom === 0) return undefined
    return top / bottom
}

export interface MeasureShape<TRow> {
    grid: GridState<TRow>
    values: PivotMeasure<TRow>[]
    columnDefs: ColumnDef<TRow>[]
    crossing: Crossing
    onRows: boolean
    totalColumn: string | undefined
    columnSubtotal: ((header: string) => string) | undefined
    warnRunning: () => void
}

export function crossingMeasures<TRow>(
    all: RowNode<TRow>[],
    shape: MeasureShape<TRow>
): Record<string, Aggregation<TRow>>[] {
    const { grid, values, columnDefs, crossing, totalColumn, columnSubtotal } = shape
    const measuresDown = shape.onRows
    const read = gateReader(grid, 'render')
    const defs = grid.columns.defs
    const columns = columnDefs
    const measures = values.map((measure) => ({
        agg: measure.agg,
        def: defs.find((def) => def.id === measure.field),
        over: measure.per,
        per: measure.per === undefined ? undefined : defs.find((d) => d.id === measure.per),
        showAs: measure.showAs
    }))

    const buckets = new WeakMap<object, Map<string, TRow[]>>()
    const bucketsFor = (rows: TRow[]): Map<string, TRow[]> => {
        let found = buckets.get(rows)
        if (!found) {
            found = partitionByPath(rows, columns, rawRead)
            buckets.set(rows, found)
        }
        return found
    }

    const reduceWith = (def: ColumnDef<TRow>, agg: Aggregation<TRow>, rows: TRow[]): unknown =>
        aggregate(
            agg,
            rows.map((row) => read({ id: '', row, index: 0 } as RowNode<TRow>, def)),
            rows
        )

    const reduce = (index: number, rows: TRow[] | undefined): unknown => {
        const measure = measures[index]!
        if (!measure.def || !rows || rows.length === 0) return undefined

        const top = reduceWith(measure.def, measure.agg, rows)
        if (measure.over === undefined) return top
        if (!measure.per) return undefined

        return share(top, reduceWith(measure.per, measure.agg, rows))
    }

    const ordered = crossing.paths.map((path) => pathId(path))
    const placeOf = placesOf(ordered)

    const series = cacheByRows<TRow>()
    const valuesAcross = (index: number, rows: TRow[]): (number | null)[] =>
        series(rows, index, () =>
            ordered.map((id) => numericOrNull(reduce(index, bucketsFor(rows).get(id))))
        ) as (number | null)[]

    const running = (index: number, rows: TRow[], at: number): unknown => {
        const measure = measures[index]!
        if (measure.over !== undefined || !ADDITIVE.has(String(measure.agg))) {
            shape.warnRunning()
            return undefined
        }
        const across = valuesAcross(index, rows)
        let total: number | null = null
        for (let step = 0; step <= at; step++) {
            const value = across[step]
            if (value !== null && value !== undefined) total = (total ?? 0) + value
        }
        return total ?? undefined
    }

    const neighbour = (index: number, rows: TRow[], at: number): unknown => {
        const how = measures[index]!.showAs
        const across = valuesAcross(index, rows)
        const here = across[at] ?? null

        if (how === 'rankInRow') {
            if (here === null) return undefined
            const bigger = across.filter(
                (value) => value !== null && value !== undefined && value > here
            )
            return bigger.length + 1
        }

        const before = at > 0 ? (across[at - 1] ?? null) : null
        if (here === null || before === null) return undefined
        if (how === 'differenceFrom') return here - before
        return before === 0 ? undefined : (here - before) / before
    }

    const shares = measures.some((measure) => measure.showAs)
    const everyRow = shares ? all.map((node) => node.row) : []
    const everyBucket = shares ? partitionByPath(everyRow, columns, rawRead) : undefined

    const cached = cacheByKey()
    const wholeOf = (index: number): unknown =>
        cached(`whole:${index}`, () => reduce(index, everyRow))
    const keyOf = (index: number, key: string): unknown =>
        cached(`key:${index}:${key}`, () => reduce(index, everyBucket?.get(key)))

    const perGroup = cacheByRows<TRow>()
    const gatheredOf = (index: number, rows: TRow[]): unknown =>
        perGroup(rows, index, () => reduce(index, rows))

    const shown = (
        index: number,
        raw: () => unknown,
        rows: TRow[],
        key: string | undefined
    ): unknown => {
        const how = measures[index]!.showAs
        if (!how) return raw()

        if (ALONG_THE_ROW.has(how)) {
            const at = key === undefined ? undefined : placeOf(key)
            if (at === undefined) return undefined
            return how === 'runningTotal' ? running(index, rows, at) : neighbour(index, rows, at)
        }

        if (how === 'percentOfRow') return share(raw(), gatheredOf(index, rows))
        if (how === 'percentOfTotal') return share(raw(), wholeOf(index))
        return share(raw(), key === undefined ? wholeOf(index) : keyOf(index, key))
    }

    const slots = measuresDown
        ? measures.map((_measure, index) => [index])
        : [measures.map((_measure, index) => index)]
    const leafOf = (index: number): number => (measuresDown ? 0 : index)

    const crossed = crossing
    const subtotals = columnSubtotal ? subtotalPaths(crossed.tree) : []

    return slots.map((indexes) => {
        const out: Record<string, Aggregation<TRow>> = {}

        for (const path of crossed.paths) {
            const id = pathId(path)
            for (const index of indexes) {
                out[crossingId(path, leafOf(index))] = (_values, rows) =>
                    shown(index, () => reduce(index, bucketsFor(rows).get(id)), rows, id)
            }
        }

        if (columnSubtotal) {
            for (const path of subtotals) {
                const id = pathId(path)
                for (const index of indexes) {
                    out[subtotalId(path, leafOf(index))] = (_values, rows) =>
                        shown(index, () => reduce(index, bucketsFor(rows).get(id)), rows, id)
                }
            }
        }

        if (totalColumn !== undefined) {
            for (const index of indexes) {
                out[totalId(leafOf(index))] = (_values, rows) =>
                    shown(index, () => reduce(index, rows), rows, undefined)
            }
        }
        return out
    })
}
