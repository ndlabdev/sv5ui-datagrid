import { gateReader, type GridState, PIPELINE_ORDER, rawRead } from '../../core/grid/index.js'
import {
    type ColumnDef,
    type GridFeature,
    type MenuContext,
    type MenuItem,
    type RowNode
} from '../../core/types/index.js'
import { mutator, numericOrNull } from '../../core/utils/index.js'
import { flattenColumns } from '../../core/columns/header-groups.js'
import { getSorting } from '../sorting/index.js'
import { sortNodes } from '../sorting/sort.js'
import { aggregate } from '../grouping/aggregate.js'
import { buildGroupNodes, groupNodeId } from '../grouping/group-nodes.js'
import { buildGrandTotalNode, totalsKindOf } from '../grouping/totals-nodes.js'
import type { Aggregation } from '../grouping/grouping.types.js'
import {
    type ColumnGroupMode,
    type Crossing,
    crossingId,
    cacheByKey,
    cacheByRows,
    crossingIndex,
    defaultHeader,
    measuredLook,
    keepOnly,
    isPivotColumn,
    missingFields,
    offAxis,
    partitionByPath,
    pathId,
    pivotColumnDefs,
    pivotCrossing,
    rowsInGroup,
    startsWithKeys,
    subtotalId,
    subtotalPaths,
    readServerCell,
    serverCrossing,
    totalId
} from './pivot-columns.js'
import { reorderGroups } from './pivot-sort.js'
import type { PivotRequest } from '../server-row-model/server-row-model.types.js'
import type { SortState } from '../../core/types/index.js'
import type { PivotMeasure, PivotOptions, PivotShowAs } from './pivot.types.js'

const PIVOT = 'pivot'
const SERVER_ROW_MODEL = 'serverRowModel'

const RESHAPES_THE_ROWS: Record<string, string> = {
    grouping: 'gathers the rows the same way pivot does',
    tree: 'draws a hierarchy out of the rows pivot would gather',
    masterDetail: 'opens a panel under a row, and a pivot row is a total, not a row'
}
const DEFAULT_MAX_COLUMNS = 100
const EMPTY: Crossing = { tree: [], paths: [], overflowed: false }

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

    get #limit(): number {
        return this.#options.maxColumns ?? DEFAULT_MAX_COLUMNS
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
            values.push({ field: measure.field, agg: measure.agg })
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

    #columnDefs(): ColumnDef<TRow>[] {
        const defs = this.#grid.columns.defs
        const found = this.columns.map((id) => defs.find((def) => def.id === id))
        return found.every((def) => def !== undefined) ? (found as ColumnDef<TRow>[]) : []
    }

    #crossing = $derived.by(() => {
        if (!this.isCrossing) return EMPTY
        const limit = {
            max: this.#limit,
            leavesPerPath: this.values.length,
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
            declared: this.#options.columnKeys
        })
    })

    #index = $derived.by(() =>
        crossingIndex({
            paths: this.#crossing.paths,
            subtotals: this.columnSubtotal ? subtotalPaths(this.#crossing.tree) : [],
            measures: this.values.length,
            withTotal: this.totalColumn !== undefined
        })
    )

    ownsSort = (columnId: string): boolean => this.#index.has(columnId)

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
            ...this.values.map((measure) => measure.field)
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
        if (!this.#onServer && this.#columnDefs().length === 0) return false
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
        const generated = pivotColumnDefs<TRow>(found, {
            measures: this.values,
            looks: this.values.map((measure) =>
                measuredLook(
                    measure,
                    sources.find((source) => source.id === measure.field)
                )
            ),
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
        return [...shown, ...generated]
    }

    #aggregations(all: RowNode<TRow>[]): Record<string, Aggregation<TRow>> {
        const read = gateReader(this.#grid, 'render')
        const defs = this.#grid.columns.defs
        const columns = this.#columnDefs()
        const measures = this.values.map((measure) => ({
            agg: measure.agg,
            def: defs.find((def) => def.id === measure.field),
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

        const reduce = (index: number, rows: TRow[] | undefined): unknown => {
            const measure = measures[index]!
            if (!measure.def || !rows || rows.length === 0) return undefined
            const cells = rows.map((row) =>
                read({ id: '', row, index: 0 } as RowNode<TRow>, measure.def!)
            )
            return aggregate(measure.agg, cells, rows)
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
            raw: unknown,
            rows: TRow[],
            key: string | undefined
        ): unknown => {
            const how = measures[index]!.showAs
            if (!how) return raw
            if (how === 'percentOfRow') return share(raw, gatheredOf(index, rows))
            if (how === 'percentOfTotal') return share(raw, wholeOf(index))
            return share(raw, key === undefined ? wholeOf(index) : keyOf(index, key))
        }

        const out: Record<string, Aggregation<TRow>> = {}
        for (const path of this.#crossing.paths) {
            const id = pathId(path)
            for (let index = 0; index < measures.length; index++) {
                out[crossingId(path, index)] = (_values, rows) =>
                    shown(index, reduce(index, bucketsFor(rows).get(id)), rows, id)
            }
        }

        if (this.columnSubtotal) {
            for (const path of subtotalPaths(this.#crossing.tree)) {
                const id = pathId(path)
                for (let index = 0; index < measures.length; index++) {
                    out[subtotalId(path, index)] = (_values, rows) =>
                        shown(index, reduce(index, bucketsFor(rows).get(id)), rows, id)
                }
            }
        }

        if (this.totalColumn !== undefined) {
            for (let index = 0; index < measures.length; index++) {
                out[totalId(index)] = (_values, rows) =>
                    shown(index, reduce(index, rows), rows, undefined)
            }
        }
        return out
    }

    #order(rows: RowNode<TRow>[]): RowNode<TRow>[] {
        if (!this.#crossesTheSort) return rows

        const sort = this.#sort
        const defs = this.#grid.columns.all.map((column) => column.def)
        const nulls = getSorting(this.#grid)?.nulls

        return reorderGroups(rows, (siblings) => sortNodes(siblings, defs, sort, nulls))
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
        const nodes = this.#grid.filteredNodes
        const fields = this.#rowDefs()

        const gathered =
            totalsKindOf(node.id) === 'grandTotal'
                ? nodes.map((row) => row.row)
                : rowsInGroup(nodes, { fields, read, idOf: groupNodeId, wanted: node.id })

        if (ref.keys.length === 0) return gathered

        const across = this.#columnDefs()
        return gathered.filter((row) => startsWithKeys(row, across, rawRead, ref.keys))
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

        const read = gateReader(this.#grid, 'render')
        const aggregations = this.#aggregations(nodes)
        const columns = this.#bodyColumns()

        const rows = buildGroupNodes(nodes, {
            by: this.rows,
            columns,
            aggregations,
            isExpanded: (id) => this.#grid.expansion.isExpanded(id),
            groupLabel: (key) => key,
            read
        })

        const ordered = this.#order(rows)

        const label = this.totalRow
        if (label === undefined || nodes.length === 0) return ordered

        return [
            ...ordered,
            buildGrandTotalNode(nodes, {
                read,
                columns,
                aggregations,
                labelColumnId: this.rows[0],
                grandTotalLabel: () => label
            })
        ]
    }
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
        ...(named
            ? {
                  values: state.values.map((measure) => ({
                      field: measure.field,
                      agg: measure.agg as string,
                      ...(measure.header === undefined ? {} : { header: measure.header })
                  }))
              }
            : {})
    }
}

function fieldsIn<TRow>(slice: Record<string, unknown>, key: string, grid: GridState<TRow>) {
    const found = slice[key]
    if (!Array.isArray(found)) return undefined
    return found.filter(
        (id): id is string => typeof id === 'string' && grid.columns.get(id) !== undefined
    )
}

function measuresIn<TRow>(
    slice: Record<string, unknown>,
    grid: GridState<TRow>
): PivotMeasure<TRow>[] | undefined {
    const found = slice.values
    if (!Array.isArray(found)) return undefined

    const kept = found.flatMap((entry): PivotMeasure<TRow>[] => {
        if (entry === null || typeof entry !== 'object') return []
        const { field, agg, header } = entry as Record<string, unknown>
        if (typeof field !== 'string' || typeof agg !== 'string') return []
        if (!grid.columns.get(field)) return []

        return [
            {
                field,
                agg: agg as PivotMeasure<TRow>['agg'],
                ...(typeof header === 'string' ? { header } : {})
            }
        ]
    })
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
            totalsKindOf(node.id) === 'grandTotal'
                ? { class: 'border-t border-outline-variant bg-surface-container/60 font-semibold' }
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
        isPivoting?: () => boolean
    }
}
