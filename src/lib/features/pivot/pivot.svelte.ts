import {
    type CellRead,
    gateReader,
    type GridState,
    PIPELINE_ORDER,
    rawRead
} from '../../core/grid/index.js'
import {
    type ColumnDef,
    type ColumnType,
    type GridFeature,
    type MenuContext,
    type MenuItem,
    type RowNode
} from '../../core/types/index.js'
import { mutator, numericOrNull, withComputed } from '../../core/utils/index.js'
import { flattenColumns } from '../../core/columns/header-groups.js'
import { getSorting } from '../sorting/index.js'
import { sortNodes } from '../sorting/sort.js'
import { aggregate } from '../grouping/aggregate.js'
import { buildGroupNodes, groupNodeId } from '../grouping/group-nodes.js'
import { buildGrandTotalNode, totalsKindOf } from '../grouping/totals-nodes.js'
import type { Aggregation } from '../grouping/grouping.types.js'
import {
    agreedLook,
    type ColumnGroupMode,
    type Crossing,
    crossingId,
    cacheByKey,
    cacheByRows,
    type CrossingOrder,
    crossingIndex,
    groupsByKey,
    type KeyedRows,
    defaultHeader,
    measuredLook,
    measureRowBase,
    measureRowId,
    MEASURE_COLUMN,
    keepOnly,
    isCrossingBody,
    isPivotColumn,
    missingFields,
    offAxis,
    partitionByPath,
    pathId,
    pivotColumnDefs,
    pivotCrossing,
    placesOf,
    rowsInGroup,
    startsWithKeys,
    subtotalId,
    subtotalPaths,
    readServerCell,
    serverCrossing,
    totalId
} from './pivot-columns.js'
import { alongFirstMeasure, reorderGroups } from './pivot-sort.js'
import type { PivotRequest } from '../server-row-model/server-row-model.types.js'
import type { SortState } from '../../core/types/index.js'
import type {
    PivotKeepRows,
    PivotOrderColumns,
    PivotMeasure,
    PivotOptions,
    PivotShowAs,
    PivotValuesOn
} from './pivot.types.js'

const PIVOT = 'pivot'
const SERVER_ROW_MODEL = 'serverRowModel'

const RESHAPES_THE_ROWS: Record<string, string> = {
    grouping: 'gathers the rows the same way pivot does',
    tree: 'draws a hierarchy out of the rows pivot would gather',
    masterDetail: 'opens a panel under a row, and a pivot row is a total, not a row'
}
const DEFAULT_MAX_COLUMNS = 100
const EMPTY: Crossing = { tree: [], paths: [], overflowed: false }

const ADDITIVE = new Set(['sum', 'count'])

const ALONG_THE_ROW = new Set<PivotShowAs>([
    'runningTotal',
    'differenceFrom',
    'percentDifferenceFrom',
    'rankInRow'
])

const CROSSED = Object.freeze({})

const refuseEditing = (): unknown => CROSSED

const SERVER_REFUSAL =
    'pivot() does not cross a grid on rowModel: "server": every cell would be a total over the ' +
    'blocks this client happens to hold, and a table measured that way looks exactly like a ' +
    'correct one. The server is the only side that can answer it. Register serverRowModel() and ' +
    'the crossing goes out on every request as `pivot`, with the keys coming back as ' +
    '`pivotColumns`.'

const SERVER_TOTAL_ROW =
    'pivot() draws no totalRow on rowModel: "server": the row would hold a total over the blocks ' +
    'this client happens to hold. Have the server return it as a row of its own, the way it ' +
    'returns every other row, and leave totalRow off.'

const SERVER_DRILL =
    'pivot() cannot say which rows are behind a cell on rowModel: "server": the client holds the ' +
    'crossed rows the server sent, not the rows they were measured from. Ask the server for them ' +
    'with the same crossing, or cross on the client.'

const SERVER_VALUES_ON_ROWS =
    'pivot() keeps its measures on the column axis on rowModel: "server". Putting them down the ' +
    'page means one row per measure, and the client only holds the blocks the server sent, so it ' +
    'cannot split a row it did not build. The crossing still draws, with a leaf per measure.'

const SORT_BY_FIRST_MEASURE =
    'pivot() has its measures on the row axis, where a column header names a crossing rather ' +
    'than a measure, so sorting by one sorts the groups by the first measure. Put the measure ' +
    'you mean first in values, or move the measures back to the column axis to sort by each.'

const rankOutOfRange = (at: number, many: number): string =>
    `pivot(): keepRows ranks by values[${at}], and there ${many === 1 ? 'is' : 'are'} only ` +
    `${many}. Nothing ranks the rows, so the ones kept are whichever the data listed first. ` +
    'Point measure at one of the measures, or leave it out to rank by the first.'

const SERVER_ORDER_COLUMNS =
    'pivot() keeps the order the server sent on rowModel: "server". The column axis comes back ' +
    'with the rows, and ranking it means measuring every row behind every key, which the client ' +
    'cannot do over the blocks it happens to hold. Ask the server for the order.'

const SERVER_KEEP_ROWS =
    'pivot() keeps every row it is given on rowModel: "server". Ranking the gathered rows means ' +
    'measuring all of them, and the client holds only the blocks the server sent, so the ten ' +
    'largest of what it happens to hold are not the ten largest. Ask the server for them.'

const RUNNING_AGG =
    'pivot() left a runningTotal empty: it runs only a sum or a count of one column, the ' +
    'reductions where adding the cells and measuring the rows give the same answer. A ratio does ' +
    'not add up at all, and anything else would be a guess at what running it should mean.'

const UNNAMED_AGG =
    'pivot() sent no crossing to the server: a measure reduces with a function or a ' +
    'parameterised aggregation, and only the named ones cross the wire. The grid sends no pivot ' +
    'at all rather than one missing a measure. Name the reduction, or cross on the client.'

const missing = (fields: string[]): string =>
    `pivot() found no column defined for ${fields.join(', ')}, so there is nothing to cross and ` +
    'the grid is drawing its rows unchanged. A pivot field names a column id, not a row property.'

const overflowed = (limit: number, measures: number): string =>
    `pivot() refused to draw: the column fields cross into more than ${limit} leaf columns` +
    (measures > 1 ? `, counting ${measures} per crossing for the measures` : '') +
    '. Pick fields with fewer values, narrow the data first, or raise maxColumns and accept the ' +
    'table that comes out.'

export class Pivot<TRow> {
    rows = $state.raw<string[]>([])
    columns = $state.raw<string[]>([])
    values = $state.raw<PivotMeasure<TRow>[]>([])
    totalColumn = $state.raw<string | undefined>(undefined)
    totalRow = $state.raw<string | undefined>(undefined)
    sortableColumns = $state.raw(false)
    columnGroups = $state.raw<ColumnGroupMode>('fixed')
    columnSubtotal = $state.raw<((header: string) => string) | undefined>(undefined)
    valuesOn = $state.raw<PivotValuesOn>('columns')
    keepRows = $state.raw<PivotKeepRows | undefined>(undefined)
    orderColumns = $state.raw<PivotOrderColumns | undefined>(undefined)
    maxColumns = $state.raw(DEFAULT_MAX_COLUMNS)

    #grid: GridState<TRow>
    #options: PivotOptions<TRow>

    constructor(grid: GridState<TRow>, options: PivotOptions<TRow>) {
        this.#grid = grid
        this.#options = options
        this.rows = [...options.rows]
        this.columns = [...options.columns]
        this.values = [...options.values]
        this.totalColumn = options.totalColumn
        this.totalRow = options.totalRow
        this.sortableColumns = options.sortableColumns ?? false
        this.columnGroups = options.columnGroups ?? 'fixed'
        this.columnSubtotal = options.columnSubtotal
        this.valuesOn = options.valuesOn ?? 'columns'
        this.keepRows = options.keepRows
        this.orderColumns = options.orderColumns
        this.maxColumns = options.maxColumns ?? DEFAULT_MAX_COLUMNS

        if (options.rows.length === 0 || options.columns.length === 0) {
            throw new Error('pivot() needs at least one row field and one column field')
        }
        if (options.values.length === 0) {
            throw new Error('pivot() needs at least one value to measure')
        }
        const clash = grid.features.find((feature) => feature.id in RESHAPES_THE_ROWS)
        if (clash) {
            throw new Error(
                `pivot() cannot run beside ${clash.id}(), which ${RESHAPES_THE_ROWS[clash.id]}. ` +
                    'Both decide what a row is, so only one of them may be registered.'
            )
        }
    }

    get isCrossing(): boolean {
        return this.rows.length > 0 && this.columns.length > 0 && this.values.length > 0
    }

    setRows = mutator((fields: string[]): void => {
        this.rows = [...fields]
    })

    setColumns = mutator((fields: string[]): void => {
        this.columns = [...fields]
    })

    setValues = mutator((measures: PivotMeasure<TRow>[]): void => {
        this.values = [...measures]
    })

    addRowField = mutator((field: string): void => {
        if (this.rows.includes(field)) return
        this.rows = [...this.rows, field]
        this.columns = this.columns.filter((id) => id !== field)
    })

    addColumnField = mutator((field: string): void => {
        if (this.columns.includes(field)) return
        this.columns = [...this.columns, field]
        this.rows = this.rows.filter((id) => id !== field)
    })

    removeField = mutator((field: string): void => {
        this.rows = this.rows.filter((id) => id !== field)
        this.columns = this.columns.filter((id) => id !== field)
    })

    setTotalColumn = mutator((header: string | undefined): void => {
        this.totalColumn = header
    })

    setTotalRow = mutator((header: string | undefined): void => {
        this.totalRow = header
    })

    setColumnGroups = mutator((mode: ColumnGroupMode): void => {
        this.columnGroups = mode
    })

    setKeepRows = mutator((keep: PivotKeepRows | undefined): void => {
        this.keepRows = keep
    })

    setOrderColumns = mutator((order: PivotOrderColumns | undefined): void => {
        this.orderColumns = order
    })

    setValuesOn = mutator((where: PivotValuesOn): void => {
        this.valuesOn = where
    })

    setSortableColumns = mutator((sortable: boolean): void => {
        this.sortableColumns = sortable
    })

    setColumnSubtotal = mutator((label: ((header: string) => string) | undefined): void => {
        this.columnSubtotal = label
    })

    pivotableColumns(): { id: string; header: string }[] {
        return offAxis(flattenColumns(this.#grid.columns.defs), [...this.rows, ...this.columns])
    }

    moveRowField = mutator((field: string, offset: number): void => {
        this.rows = moved(this.rows, field, offset)
    })

    moveColumnField = mutator((field: string, offset: number): void => {
        this.columns = moved(this.columns, field, offset)
    })

    addValue = mutator((field: string, agg: Aggregation<TRow> = 'sum'): void => {
        this.values = [...this.values, { field, agg }]
    })

    removeValue = mutator((at: number): void => {
        this.values = this.values.filter((_measure, index) => index !== at)
    })

    setValueAgg = mutator((at: number, agg: Aggregation<TRow>): void => {
        this.values = this.values.map((measure, index) =>
            index === at ? { ...measure, agg } : measure
        )
    })

    setValueShowAs = mutator((at: number, showAs: PivotShowAs | undefined): void => {
        this.values = this.values.map((measure, index) =>
            index === at ? { ...measure, showAs } : measure
        )
    })

    clearPivot = mutator((): void => {
        this.rows = []
        this.columns = []
    })

    setMaxColumns = mutator((limit: number): void => {
        this.maxColumns = limit
    })

    get #limit(): number {
        return this.maxColumns
    }

    #warned = false

    #refuseServer(): boolean {
        if (!this.#onServer) return false
        if (!this.#warned && !this.serverHandled) {
            this.#warned = true
            // eslint-disable-next-line no-console
            console.warn(SERVER_REFUSAL)
        }
        return true
    }

    get #onServer(): boolean {
        return this.#grid.rowModel === 'server'
    }

    get #onRows(): boolean {
        return this.valuesOn === 'rows' && this.values.length > 0 && !this.#onServer
    }

    get serverHandled(): boolean {
        if (!this.#onServer) return false
        return this.#grid.features.some((feature) => feature.id === SERVER_ROW_MODEL)
    }

    get request(): PivotRequest | undefined {
        const values: { field: string; agg: string }[] = []
        for (const measure of this.values) {
            if (typeof measure.agg !== 'string') {
                if (!this.#aggWarned) {
                    this.#aggWarned = true
                    // eslint-disable-next-line no-console
                    console.warn(UNNAMED_AGG)
                }
                return undefined
            }
            values.push({
                field: measure.field,
                agg: measure.agg,
                ...(measure.per === undefined ? {} : { per: measure.per })
            })
        }
        const sort = this.#sort.flatMap((entry) => {
            const ref = this.#index.get(entry.columnId)
            return ref ? [{ keys: ref.keys, measure: ref.measure, direction: entry.direction }] : []
        })

        return {
            rows: [...this.rows],
            columns: [...this.columns],
            values,
            ...(sort.length > 0 ? { sort } : {})
        }
    }

    #aggWarned = false

    warnedSave = false

    serverColumns = $state.raw<string[][]>([])

    setServerColumns = mutator((paths: string[][]): void => {
        if (samePaths(this.serverColumns, paths)) return
        this.serverColumns = paths
    })

    #fieldsResolve(): boolean {
        const defs = this.#grid.columns.defs
        const known = (id: string): boolean => defs.some((def) => def.id === id)
        return this.values.every(
            (measure) => known(measure.field) && (measure.per === undefined || known(measure.per))
        )
    }

    #columnDefs(): ColumnDef<TRow>[] {
        const defs = this.#grid.columns.defs
        const found = this.columns.map((id) => defs.find((def) => def.id === id))
        return found.every((def) => def !== undefined) ? (found as ColumnDef<TRow>[]) : []
    }

    #crossing = $derived.by(() => {
        if (!this.isCrossing) return EMPTY
        const limit = {
            max: this.#limit,
            leavesPerPath: this.#onRows ? 1 : this.values.length,
            withSubtotals: this.columnSubtotal !== undefined
        }

        if (this.#onServer) {
            if (!this.serverHandled || this.serverColumns.length === 0) return EMPTY
            return serverCrossing(this.serverColumns, limit)
        }
        const columns = this.#columnDefs()
        if (columns.length === 0) return EMPTY

        return pivotCrossing(this.#grid.sourceNodes, {
            columns,
            read: rawRead,
            limit,
            declared: this.#options.columnKeys,
            ...(this.#ranking ? { order: this.#ranking } : {})
        })
    })

    #index = $derived.by(() =>
        crossingIndex({
            paths: this.#crossing.paths,
            subtotals: this.columnSubtotal ? subtotalPaths(this.#crossing.tree) : [],
            measures: this.#onRows ? 1 : this.values.length,
            withTotal: this.totalColumn !== undefined
        })
    )

    ownsSort = (columnId: string): boolean => this.#index.has(columnId)

    crossingMeasure = (columnId: string): number | undefined =>
        isCrossingBody(columnId) ? this.#index.get(columnId)?.measure : undefined

    inCrossingBody = (nodeId: string): boolean => measureRowBase(nodeId).startsWith('group:')

    get #sort(): SortState[] {
        return getSorting(this.#grid)?.sort ?? []
    }

    get #crossesTheSort(): boolean {
        return this.#sort.some((entry) => this.#index.has(entry.columnId))
    }

    #missingWarned = false

    #warnMissing(defs: ColumnDef<TRow>[]): void {
        const absent = missingFields(defs, [
            ...this.columns,
            ...this.values.map((measure) => measure.field),
            ...this.values.flatMap((measure) => (measure.per === undefined ? [] : [measure.per]))
        ])

        if (absent.length === 0 || this.#missingWarned) return
        this.#missingWarned = true
        // eslint-disable-next-line no-console
        console.warn(missing(absent))
    }

    #totalRowWarned = false

    #warnTotalRow(): void {
        if (!this.#onServer || this.totalRow === undefined) return
        if (this.#totalRowWarned) return
        this.#totalRowWarned = true
        // eslint-disable-next-line no-console
        console.warn(SERVER_TOTAL_ROW)
    }

    #valuesOnRowsWarned = false

    #warnValuesOnRows(): void {
        if (!this.#onServer || this.valuesOn !== 'rows') return
        if (this.#valuesOnRowsWarned) return

        this.#valuesOnRowsWarned = true
        // eslint-disable-next-line no-console
        console.warn(SERVER_VALUES_ON_ROWS)
    }

    #orderWarned = false

    #warnOrderColumns(): void {
        if (!this.#onServer || this.orderColumns === undefined) return
        if (this.#orderWarned) return

        this.#orderWarned = true
        // eslint-disable-next-line no-console
        console.warn(SERVER_ORDER_COLUMNS)
    }

    #keepRowsWarned = false

    #warnKeepRows(): void {
        if (!this.#onServer || this.keepRows === undefined) return
        if (this.#keepRowsWarned) return

        this.#keepRowsWarned = true
        // eslint-disable-next-line no-console
        console.warn(SERVER_KEEP_ROWS)
    }

    #overflowWarned = false

    #warnOverflow(): void {
        if (this.#overflowWarned) return
        this.#overflowWarned = true
        // eslint-disable-next-line no-console
        console.warn(overflowed(this.#limit, this.values.length))
    }

    #stands(defs: ColumnDef<TRow>[]): boolean {
        if (!this.isCrossing) return false
        if (this.#onServer && !this.serverHandled) return false

        this.#warnMissing(defs)
        this.#warnTotalRow()
        this.#warnValuesOnRows()
        this.#warnKeepRows()
        this.#warnOrderColumns()
        if (!this.#onServer && this.#columnDefs().length === 0) return false
        if (!this.#onServer && !this.#fieldsResolve()) return false
        if (this.#crossing.overflowed) {
            this.#warnOverflow()
            return false
        }
        return true
    }

    shapeColumns = (defs: ColumnDef<TRow>[]): ColumnDef<TRow>[] => {
        if (!this.#stands(defs)) return defs

        const found = this.#crossing
        const shown = keepOnly(defs, this.rows)
        const sources = this.#grid.columns.defs
        const looks = this.values.map((measure) =>
            measuredLook(
                measure,
                sources.find((source) => source.id === measure.field)
            )
        )
        const generated = pivotColumnDefs<TRow>(found, {
            measures: this.#onRows ? this.values.slice(0, 1) : this.values,
            looks: this.#onRows ? [agreedLook(looks)] : looks,
            totalHeader: found.paths.length > 0 ? this.totalColumn : undefined,
            subtotalHeader: this.columnSubtotal,
            groups: this.columnGroups,
            header:
                this.#options.columnHeader ??
                defaultHeader(this.#columnDefs(), this.#grid.locale, this.#grid.labels.blankValue),
            sortable: this.sortableColumns,
            ...(this.#onServer
                ? {
                      accessor: (keys: string[], measure: number) => (row: TRow) =>
                          readServerCell(row, keys, measure)
                  }
                : {})
        })
        if (!this.#onRows) return [...shown, ...generated]
        return [...shown, this.#measureColumn(), ...generated]
    }

    #measureColumn(): ColumnDef<TRow> {
        return {
            id: MEASURE_COLUMN,
            header: this.#grid.labels.pivotValues,
            sortable: false,
            filter: false
        }
    }

    #measureLabel = (at: number): string => {
        const measure = this.values[at]
        if (!measure) return ''
        return measure.header ?? measure.field
    }

    #aggregations(all: RowNode<TRow>[]): Record<string, Aggregation<TRow>>[] {
        const read = gateReader(this.#grid, 'render')
        const defs = this.#grid.columns.defs
        const columns = this.#columnDefs()
        const measures = this.values.map((measure) => ({
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

        const ordered = this.#crossing.paths.map((path) => pathId(path))
        const placeOf = placesOf(ordered)

        const series = cacheByRows<TRow>()
        const valuesAcross = (index: number, rows: TRow[]): (number | null)[] =>
            series(rows, index, () =>
                ordered.map((id) => numericOrNull(reduce(index, bucketsFor(rows).get(id))))
            ) as (number | null)[]

        const running = (index: number, rows: TRow[], at: number): unknown => {
            const measure = measures[index]!
            if (measure.over !== undefined || !ADDITIVE.has(String(measure.agg))) {
                this.#warnRunning()
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
                return how === 'runningTotal'
                    ? running(index, rows, at)
                    : neighbour(index, rows, at)
            }

            if (how === 'percentOfRow') return share(raw(), gatheredOf(index, rows))
            if (how === 'percentOfTotal') return share(raw(), wholeOf(index))
            return share(raw(), key === undefined ? wholeOf(index) : keyOf(index, key))
        }

        const onRows = this.#onRows
        const slots = onRows
            ? measures.map((_measure, index) => [index])
            : [measures.map((_measure, index) => index)]
        const leafOf = (index: number): number => (onRows ? 0 : index)

        const crossed = this.#crossing
        const subtotals = this.columnSubtotal ? subtotalPaths(crossed.tree) : []

        return slots.map((indexes) => {
            const out: Record<string, Aggregation<TRow>> = {}

            for (const path of crossed.paths) {
                const id = pathId(path)
                for (const index of indexes) {
                    out[crossingId(path, leafOf(index))] = (_values, rows) =>
                        shown(index, () => reduce(index, bucketsFor(rows).get(id)), rows, id)
                }
            }

            if (this.columnSubtotal) {
                for (const path of subtotals) {
                    const id = pathId(path)
                    for (const index of indexes) {
                        out[subtotalId(path, leafOf(index))] = (_values, rows) =>
                            shown(index, () => reduce(index, bucketsFor(rows).get(id)), rows, id)
                    }
                }
            }

            if (this.totalColumn !== undefined) {
                for (const index of indexes) {
                    out[totalId(leafOf(index))] = (_values, rows) =>
                        shown(index, () => reduce(index, rows), rows, undefined)
                }
            }
            return out
        })
    }

    get #ranking(): CrossingOrder<TRow> | undefined {
        const order = this.orderColumns
        if (!order) return undefined

        const at = order.measure ?? 0
        return {
            direction: order.direction ?? 'desc',
            score: (rows: TRow[]) => numericOrNull(this.#measureOver(at, rows, rawRead))
        }
    }

    #measureOver(at: number, rows: TRow[], read: CellRead<TRow>): unknown {
        const measure = this.values[at]
        if (!measure || rows.length === 0) return undefined

        const defs = this.#grid.columns.defs
        const def = defs.find((candidate) => candidate.id === measure.field)
        if (!def) return undefined

        const cells = (column: ColumnDef<TRow>): unknown[] =>
            rows.map((row) => read({ id: '', row, index: 0 } as RowNode<TRow>, column))

        const top = aggregate(measure.agg, cells(def), rows)
        if (measure.per === undefined) return top

        const per = defs.find((candidate) => candidate.id === measure.per)
        return per ? share(top, aggregate(measure.agg, cells(per), rows)) : undefined
    }

    #cutAt(): { many: number; field: ColumnDef<TRow>; at: number } | undefined {
        const keep = this.keepRows
        const many = keep?.top ?? keep?.bottom
        if (!keep || many === undefined || many <= 0) return undefined

        const field = this.#rowDefs()[0]
        if (!field) return undefined

        return { many, field, at: keep.measure ?? 0 }
    }

    #ranked(nodes: RowNode<TRow>[]): { kept: RowNode<TRow>[]; lost: RowNode<TRow>[] } | undefined {
        const cut = this.#cutAt()
        if (!cut) return undefined

        const { many, field, at } = cut
        const buckets = groupsByKey(nodes, field, rawRead)
        if (buckets.length <= many) return undefined

        if (at >= this.values.length) this.#warnRankMeasure(at)

        const read = gateReader(this.#grid, 'render')
        const scored = buckets.map((bucket) => ({
            bucket,
            score: numericOrNull(
                this.#measureOver(
                    at,
                    bucket.nodes.map((node) => node.row),
                    read
                )
            )
        }))

        const order = byScore(scored, this.keepRows?.top === undefined)
        return {
            kept: order.slice(0, many).flatMap((entry) => entry.bucket.nodes),
            lost: order.slice(many).flatMap((entry) => entry.bucket.nodes)
        }
    }

    #keep(nodes: RowNode<TRow>[]): RowNode<TRow>[] {
        const split = this.#ranked(nodes)
        if (!split) return nodes

        const label = this.keepRows?.others
        if (label === undefined) return split.kept

        const field = this.#rowDefs()[0]!
        return [
            ...split.kept,
            ...split.lost.map((node) => ({
                ...node,
                row: withComputed(node.row, { [field.id]: label })
            }))
        ]
    }

    #order(rows: RowNode<TRow>[]): RowNode<TRow>[] {
        if (!this.#crossesTheSort) return rows

        const sort = this.#sort
        const defs = this.#grid.columns.all.map((column) => column.def)
        const nulls = getSorting(this.#grid)?.nulls

        const order = (siblings: RowNode<TRow>[]): RowNode<TRow>[] =>
            sortNodes(siblings, defs, sort, nulls)
        const gathers = (node: RowNode<TRow>): boolean => measureRowBase(node.id) === node.id

        if (!this.#onRows) return reorderGroups(rows, order, gathers)

        if (this.values.length > 1) this.#warnSortMeasure()
        return reorderGroups(
            rows,
            alongFirstMeasure(rows, (id) => measureRowId(id, 0), order),
            gathers
        )
    }

    #sortMeasureWarned = false

    #warnSortMeasure(): void {
        if (this.#sortMeasureWarned) return
        this.#sortMeasureWarned = true
        // eslint-disable-next-line no-console
        console.warn(SORT_BY_FIRST_MEASURE)
    }

    #rankWarned = false

    #warnRankMeasure(at: number): void {
        if (this.#rankWarned) return
        this.#rankWarned = true
        // eslint-disable-next-line no-console
        console.warn(rankOutOfRange(at, this.values.length))
    }

    #runningWarned = false

    #warnRunning(): void {
        if (this.#runningWarned) return
        this.#runningWarned = true
        // eslint-disable-next-line no-console
        console.warn(RUNNING_AGG)
    }

    #drillWarned = false

    rowsBehind(node: RowNode<TRow>, columnId: string): TRow[] {
        const ref = this.#index.get(columnId)
        if (!ref || !this.isCrossing) return []

        if (this.#onServer) {
            if (!this.#drillWarned) {
                this.#drillWarned = true
                // eslint-disable-next-line no-console
                console.warn(SERVER_DRILL)
            }
            return []
        }

        const read = gateReader(this.#grid, 'render')
        const fields = this.#rowDefs()
        const wanted = measureRowBase(node.id)
        const gathered = this.#rowsUnder(wanted, read, fields)

        if (ref.keys.length === 0) return gathered

        const across = this.#columnDefs()
        return gathered.filter((row) => startsWithKeys(row, across, rawRead, ref.keys))
    }

    #othersId(): string | undefined {
        const label = this.keepRows?.others
        const field = this.#rowDefs()[0]
        if (label === undefined || !field) return undefined
        return groupNodeId([{ columnId: field.id, key: label }])
    }

    #rowsUnder(wanted: string, read: CellRead<TRow>, fields: ColumnDef<TRow>[]): TRow[] {
        const source = this.#grid.filteredNodes
        const split = this.#ranked(source)
        if (split && wanted === this.#othersId()) return split.lost.map((entry) => entry.row)

        const gathersTheRest = this.keepRows?.others !== undefined
        const shown = gathersTheRest ? source : (split?.kept ?? source)

        if (totalsKindOf(wanted) === 'grandTotal') return shown.map((entry) => entry.row)
        return rowsInGroup(shown, { fields, read, idOf: groupNodeId, wanted })
    }

    #rowDefs(): ColumnDef<TRow>[] {
        const defs = this.#grid.columns.defs
        return this.rows.flatMap((id) => {
            const found = defs.find((def) => def.id === id)
            return found ? [found] : []
        })
    }

    #bodyColumns(): ColumnDef<TRow>[] {
        return this.#grid.columns.all
            .map((column) => column.def)
            .filter((def) => !isPivotColumn(def.id))
    }

    apply = (nodes: RowNode<TRow>[]): RowNode<TRow>[] => {
        if (!this.isCrossing) return nodes
        if (this.#refuseServer()) return nodes
        if (this.#crossing.overflowed || this.#columnDefs().length === 0) return nodes
        if (!this.#fieldsResolve()) return nodes

        const kept = this.#keep(nodes)
        const read = gateReader(this.#grid, 'render')
        const aggregations = this.#aggregations(kept)
        const columns = this.#bodyColumns()

        const rows = buildGroupNodes(kept, {
            by: this.rows,
            columns,
            aggregations: this.#onRows ? {} : aggregations[0]!,
            isExpanded: (id) => this.#grid.expansion.isExpanded(id),
            groupLabel: (key) => key,
            opensToRows: false,
            read,
            ...(this.#onRows
                ? {
                      repeat: {
                          count: aggregations.length,
                          aggregationsAt: (at: number) => aggregations[at]!,
                          idAt: measureRowId,
                          fieldsAt: (at: number) => ({ [MEASURE_COLUMN]: this.#measureLabel(at) })
                      }
                  }
                : {})
        })

        const ordered = this.#order(rows)

        const label = this.totalRow
        if (label === undefined || kept.length === 0) return ordered

        return [...ordered, ...this.#totalRows(kept, aggregations, { columns, label, read })]
    }

    #totalRows(
        nodes: RowNode<TRow>[],
        aggregations: Record<string, Aggregation<TRow>>[],
        into: { columns: ColumnDef<TRow>[]; label: string; read: CellRead<TRow> }
    ): RowNode<TRow>[] {
        const build = (
            record: Record<string, Aggregation<TRow>>,
            labelColumnId: string | undefined,
            text: string
        ): RowNode<TRow> =>
            buildGrandTotalNode(nodes, {
                read: into.read,
                columns: into.columns,
                aggregations: record,
                labelColumnId,
                grandTotalLabel: () => text
            })

        if (!this.#onRows) return [build(aggregations[0]!, this.rows[0], into.label)]

        const head = build({}, this.rows[0], into.label)
        return [
            head,
            ...aggregations.map((record, at) => ({
                ...build(record, MEASURE_COLUMN, this.#measureLabel(at)),
                id: measureRowId(head.id, at),
                meta: { level: 1, setSize: aggregations.length, posInSet: at + 1 }
            }))
        ]
    }
}

interface Scored<TRow> {
    bucket: KeyedRows<TRow>
    score: number | null
}

function byScore<TRow>(scored: Scored<TRow>[], smallestFirst: boolean): Scored<TRow>[] {
    const known = scored.filter((entry) => entry.score !== null)
    const unknown = scored.filter((entry) => entry.score === null)

    known.sort((left, right) =>
        smallestFirst ? left.score! - right.score! : right.score! - left.score!
    )

    return [...known, ...unknown]
}

function moved(fields: string[], field: string, offset: number): string[] {
    const from = fields.indexOf(field)
    if (from < 0) return fields

    const to = from + offset
    if (to < 0 || to >= fields.length) return fields

    const next = [...fields]
    next.splice(from, 1)
    next.splice(to, 0, field)
    return next
}

function share(value: unknown, whole: unknown): unknown {
    const top = numericOrNull(value)
    const bottom = numericOrNull(whole)
    if (top === null || bottom === null || bottom === 0) return undefined
    return top / bottom
}

function samePaths(left: string[][], right: string[][]): boolean {
    if (left.length !== right.length) return false
    return left.every((path, index) => {
        const other = right[index]!
        return path.length === other.length && path.every((key, depth) => key === other[depth])
    })
}

export function getPivot<TRow>(grid: GridState<TRow>): Pivot<TRow> | undefined {
    return grid.feature<Pivot<TRow>>(PIVOT)
}

const UNNAMED_SAVE =
    'pivot() left its measures out of the snapshot: one reduces with a function or a ' +
    'parameterised aggregation, and only the named ones survive being written down. The crossing ' +
    'is saved; the measures stay as the grid was built with.'

function serializePivot<TRow>(state: Pivot<TRow>): unknown {
    if (!state.isCrossing) return undefined

    const named = state.values.every((measure) => typeof measure.agg === 'string')
    if (!named && !state.warnedSave) {
        state.warnedSave = true
        // eslint-disable-next-line no-console
        console.warn(UNNAMED_SAVE)
    }

    return {
        rows: [...state.rows],
        columns: [...state.columns],
        columnGroups: state.columnGroups,
        columnSubtotal: state.columnSubtotal !== undefined,
        sortableColumns: state.sortableColumns,
        valuesOn: state.valuesOn,
        ...(state.keepRows === undefined ? {} : { keepRows: state.keepRows }),
        ...(state.orderColumns === undefined ? {} : { orderColumns: state.orderColumns }),
        ...(state.totalColumn === undefined ? {} : { totalColumn: state.totalColumn }),
        ...(state.totalRow === undefined ? {} : { totalRow: state.totalRow }),
        ...(named
            ? {
                  values: state.values.map((measure) => ({
                      field: measure.field,
                      agg: measure.agg as string,
                      ...(measure.header === undefined ? {} : { header: measure.header }),
                      ...(measure.showAs === undefined ? {} : { showAs: measure.showAs }),
                      ...(measure.per === undefined ? {} : { per: measure.per }),
                      ...(measure.type === undefined ? {} : { type: measure.type })
                  }))
              }
            : {})
    }
}

const SHARES: PivotShowAs[] = [
    'percentOfRow',
    'percentOfColumn',
    'percentOfTotal',
    'runningTotal',
    'differenceFrom',
    'percentDifferenceFrom',
    'rankInRow'
]
const GROUP_MODES: ColumnGroupMode[] = ['fixed', 'open', 'closed']

const VALUES_ON: PivotValuesOn[] = ['columns', 'rows']

const COLUMN_TYPES: ColumnType[] = [
    'text',
    'number',
    'currency',
    'percent',
    'date',
    'datetime',
    'boolean',
    'badge',
    'user',
    'progress',
    'rating',
    'link',
    'actions'
]

function typeIn(value: unknown): ColumnType | undefined {
    return COLUMN_TYPES.find((known) => known === value)
}

function shareIn(value: unknown): PivotShowAs | undefined {
    return SHARES.find((share) => share === value)
}

function placeIn(value: unknown): number | undefined {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) return undefined
    return value
}

function countIn(value: unknown): number | undefined {
    if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) return undefined
    return value
}

function orderColumnsIn(value: unknown): PivotOrderColumns | undefined {
    if (value === null || typeof value !== 'object') return undefined

    const shape = value as Record<string, unknown>
    const order: PivotOrderColumns = {}

    const measure = placeIn(shape.measure)
    if (measure !== undefined) order.measure = measure
    if (shape.direction === 'asc' || shape.direction === 'desc') order.direction = shape.direction
    return order
}

function keepRowsIn(value: unknown): PivotKeepRows | undefined {
    if (value === null || typeof value !== 'object') return undefined

    const shape = value as Record<string, unknown>
    const top = countIn(shape.top)
    const bottom = top === undefined ? countIn(shape.bottom) : undefined
    if (top === undefined && bottom === undefined) return undefined

    const keep: PivotKeepRows = top === undefined ? { bottom } : { top }
    const measure = placeIn(shape.measure)
    if (measure !== undefined) keep.measure = measure
    if (typeof shape.others === 'string') keep.others = shape.others
    return keep
}

function headerIn(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined
}

function fieldsIn<TRow>(slice: Record<string, unknown>, key: string, grid: GridState<TRow>) {
    const found = slice[key]
    if (!Array.isArray(found)) return undefined
    return found.filter(
        (id): id is string => typeof id === 'string' && grid.columns.get(id) !== undefined
    )
}

function withKnown<TRow>(
    measure: PivotMeasure<TRow>,
    extras: Partial<PivotMeasure<TRow>>
): PivotMeasure<TRow> {
    const held = measure as unknown as Record<string, unknown>
    for (const [key, value] of Object.entries(extras)) {
        if (value !== undefined) held[key] = value
    }
    return measure
}

function columnIn<TRow>(value: unknown, grid: GridState<TRow>): string | undefined {
    return typeof value === 'string' && grid.columns.get(value) ? value : undefined
}

function measureIn<TRow>(entry: unknown, grid: GridState<TRow>): PivotMeasure<TRow>[] {
    if (entry === null || typeof entry !== 'object') return []

    const { field, agg, header, showAs, per, type } = entry as Record<string, unknown>
    if (typeof field !== 'string' || typeof agg !== 'string') return []
    if (!grid.columns.get(field)) return []

    return [
        withKnown<TRow>(
            { field, agg: agg as PivotMeasure<TRow>['agg'] },
            {
                header: headerIn(header),
                showAs: shareIn(showAs),
                per: columnIn(per, grid),
                type: typeIn(type)
            }
        )
    ]
}

function measuresIn<TRow>(
    slice: Record<string, unknown>,
    grid: GridState<TRow>
): PivotMeasure<TRow>[] | undefined {
    const found = slice.values
    if (!Array.isArray(found)) return undefined

    const kept = found.flatMap((entry) => measureIn<TRow>(entry, grid))
    return kept.length > 0 ? kept : undefined
}

function hydratePivot<TRow>(slice: unknown, grid: GridState<TRow>): void {
    const state = getPivot(grid)
    if (!state || slice === null || typeof slice !== 'object') return

    const shape = slice as Record<string, unknown>
    const rows = fieldsIn(shape, 'rows', grid)
    const columns = fieldsIn(shape, 'columns', grid)
    const values = measuresIn<TRow>(shape, grid)

    if (rows) state.setRows(rows)
    if (columns) state.setColumns(columns)
    if (values) state.setValues(values)

    hydrateSettings(state, shape, grid)
}

function hydrateSubtotal<TRow>(
    state: Pivot<TRow>,
    shape: Record<string, unknown>,
    grid: GridState<TRow>
): void {
    if (!('columnSubtotal' in shape)) return
    if (shape.columnSubtotal !== true) {
        state.setColumnSubtotal(undefined)
        return
    }
    if (state.columnSubtotal === undefined) {
        state.setColumnSubtotal(grid.labels.pivotSubtotalOf)
    }
}

function hydrateSettings<TRow>(
    state: Pivot<TRow>,
    shape: Record<string, unknown>,
    grid: GridState<TRow>
): void {
    const mode = GROUP_MODES.find((known) => known === shape.columnGroups)
    if (mode) state.setColumnGroups(mode)

    const where = VALUES_ON.find((known) => known === shape.valuesOn)
    if (where) state.setValuesOn(where)

    if ('keepRows' in shape) state.setKeepRows(keepRowsIn(shape.keepRows))
    if ('orderColumns' in shape) state.setOrderColumns(orderColumnsIn(shape.orderColumns))
    if (typeof shape.sortableColumns === 'boolean') {
        state.setSortableColumns(shape.sortableColumns)
    }

    hydrateSubtotal(state, shape, grid)

    state.setTotalColumn(headerIn(shape.totalColumn))
    state.setTotalRow(headerIn(shape.totalRow))
}

function pivotMenuItems<TRow>(ctx: MenuContext<TRow>): MenuItem[] {
    const state = getPivot(ctx.grid)
    const columnId = ctx.columnId
    if (!state || !columnId || isPivotColumn(columnId)) return []

    const labels = ctx.grid.labels
    if (state.rows.includes(columnId) || state.columns.includes(columnId)) {
        return [
            {
                id: 'pivot-remove',
                label: labels.removeFromPivot,
                icon: 'lucide:x',
                onSelect: () => state.removeField(columnId)
            }
        ]
    }

    return [
        {
            id: 'pivot-rows',
            label: labels.pivotByRow,
            icon: 'lucide:rows-3',
            onSelect: () => state.addRowField(columnId)
        },
        {
            id: 'pivot-columns',
            label: labels.pivotByColumn,
            icon: 'lucide:columns-3',
            onSelect: () => state.addColumnField(columnId)
        }
    ]
}

export function pivot<TRow>(options: PivotOptions<TRow>): GridFeature<TRow> {
    return {
        id: PIVOT,
        createState: (grid) => {
            grid.expansion.enabled = true
            return new Pivot(grid, options)
        },
        createApi: (grid) => {
            const state = getPivot(grid)!
            return {
                setPivotRows: state.setRows,
                setPivotColumns: state.setColumns,
                setPivotValues: (measures: unknown[]) =>
                    state.setValues(measures as PivotMeasure<TRow>[]),
                addPivotRowField: state.addRowField,
                addPivotColumnField: state.addColumnField,
                removePivotField: state.removeField,
                clearPivot: state.clearPivot,
                pivotRowsBehind: (node: unknown, columnId: string) =>
                    state.rowsBehind(node as RowNode<TRow>, columnId),
                setPivotTotalColumn: state.setTotalColumn,
                setPivotTotalRow: state.setTotalRow,
                setPivotColumnGroups: state.setColumnGroups,
                setPivotColumnSubtotal: state.setColumnSubtotal,
                setPivotSortableColumns: state.setSortableColumns,
                setPivotValuesOn: (where: unknown) => state.setValuesOn(where as PivotValuesOn),
                setPivotKeepRows: (keep: unknown) =>
                    state.setKeepRows(keep as PivotKeepRows | undefined),
                pivotKeepRows: () => state.keepRows,
                setPivotOrderColumns: (order: unknown) =>
                    state.setOrderColumns(order as PivotOrderColumns | undefined),
                pivotOrderColumns: () => state.orderColumns,
                pivotValuesOn: () => state.valuesOn,
                pivotRows: () => [...state.rows],
                pivotColumns: () => [...state.columns],
                pivotValues: () => [...state.values],
                setPivotMaxColumns: state.setMaxColumns,
                pivotMaxColumns: () => state.maxColumns,
                isPivoting: () => state.isCrossing
            }
        },
        menuItems: pivotMenuItems,
        serialize: (grid) => {
            const state = getPivot(grid)
            return state ? serializePivot(state) : undefined
        },
        hydrate: hydratePivot,
        columns: (defs, grid) => getPivot(grid)?.shapeColumns(defs) ?? defs,
        pipelineStage: {
            order: PIPELINE_ORDER.group,
            transform: (nodes, grid) => getPivot(grid)?.apply(nodes) ?? nodes
        },
        cellValue: ({ column, purpose }) =>
            purpose === 'edit' && isPivotColumn(column.id) ? refuseEditing : undefined,
        cellDecoration: ({ node }) =>
            totalsKindOf(measureRowBase(node.id)) === 'grandTotal'
                ? { class: 'bg-surface-container/60 font-semibold' }
                : undefined
    }
}

declare module '../../core/types/api.js' {
    interface GridApi {
        setPivotRows?: (fields: string[]) => void
        setPivotColumns?: (fields: string[]) => void
        setPivotValues?: (measures: unknown[]) => void
        addPivotRowField?: (field: string) => void
        addPivotColumnField?: (field: string) => void
        removePivotField?: (field: string) => void
        clearPivot?: () => void
        pivotRowsBehind?: (node: unknown, columnId: string) => unknown[]
        setPivotTotalColumn?: (header: string | undefined) => void
        setPivotTotalRow?: (header: string | undefined) => void
        setPivotColumnGroups?: (mode: 'fixed' | 'open' | 'closed') => void
        setPivotColumnSubtotal?: (label: ((header: string) => string) | undefined) => void
        setPivotSortableColumns?: (sortable: boolean) => void
        setPivotValuesOn?: (where: 'columns' | 'rows') => void
        setPivotKeepRows?: (keep: unknown) => void
        pivotKeepRows?: () => unknown
        setPivotOrderColumns?: (order: unknown) => void
        pivotOrderColumns?: () => unknown
        pivotValuesOn?: () => 'columns' | 'rows'
        pivotRows?: () => string[]
        pivotColumns?: () => string[]
        pivotValues?: () => unknown[]
        setPivotMaxColumns?: (limit: number) => void
        pivotMaxColumns?: () => number
        isPivoting?: () => boolean
    }
}
