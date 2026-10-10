import { crossingMeasures, share } from './pivot-measures.js'
import {
    MEASURE_COLUMN,
    agreedLook,
    isCrossingBody,
    isPivotColumn,
    measureRowBase,
    measureRowId
} from './pivot-ids.js'
import { defaultHeader, measuredLook } from './pivot-headers.js'
import { type CellRead, gateReader, type GridState, rawRead } from '../../core/grid/index.js'
import { type ColumnDef, type RowNode } from '../../core/types/index.js'
import { mutator, numericOrNull, withComputed } from '../../core/utils/index.js'
import { flattenColumns } from '../../core/columns/header-groups.js'
import { getSorting } from '../sorting/index.js'
import { sortNodes } from '../sorting/sort.js'
import { aggregate } from '../grouping/aggregate.js'
import { buildGroupNodes, groupNodeId } from '../grouping/group-nodes.js'
import { buildGrandTotalNode, totalsKindOf } from '../grouping/totals-nodes.js'
import type { Aggregation } from '../grouping/grouping.types.js'
import { type ColumnGroupMode, keepOnly, missingFields, pivotColumnDefs } from './pivot-columns.js'
import {
    type Crossing,
    type CrossingOrder,
    pivotCrossing,
    subtotalPaths
} from './pivot-crossing.js'
import {
    type KeyedRows,
    crossingIndex,
    groupsByKey,
    offAxis,
    rowsInGroup,
    startsWithKeys
} from './pivot-rows.js'
import { readServerCell, serverCrossing } from './pivot-server-rows.js'
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

import {
    DRILL_PAST_A_GATE,
    RESHAPES_THE_ROWS,
    RUNNING_AGG,
    SERVER_DRILL,
    SERVER_KEEP_ROWS,
    SERVER_ORDER_COLUMNS,
    SERVER_REFUSAL,
    SERVER_TOTAL_ROW,
    SERVER_VALUES_ON_ROWS,
    SORT_BY_FIRST_MEASURE,
    UNNAMED_AGG,
    missing,
    overflowed,
    rankOutOfRange
} from './pivot-warnings.js'

export const PIVOT = 'pivot'
const SERVER_ROW_MODEL = 'serverRowModel'

const DEFAULT_MAX_COLUMNS = 100
const EMPTY: Crossing = { tree: [], paths: [], overflowed: false }

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

    #announce(): void {
        this.#grid.events.emit('pivotChanged', {
            rows: [...this.rows],
            columns: [...this.columns]
        })
    }

    setRows = mutator((fields: string[]): void => {
        this.rows = [...fields]
        this.#announce()
    })

    setColumns = mutator((fields: string[]): void => {
        this.columns = [...fields]
        this.#announce()
    })

    setValues = mutator((measures: PivotMeasure<TRow>[]): void => {
        this.values = [...measures]
        this.#announce()
    })

    addRowField = mutator((field: string): void => {
        if (this.rows.includes(field)) return
        this.rows = [...this.rows, field]
        this.columns = this.columns.filter((id) => id !== field)
        this.#announce()
    })

    addColumnField = mutator((field: string): void => {
        if (this.columns.includes(field)) return
        this.columns = [...this.columns, field]
        this.rows = this.rows.filter((id) => id !== field)
        this.#announce()
    })

    removeField = mutator((field: string): void => {
        this.rows = this.rows.filter((id) => id !== field)
        this.columns = this.columns.filter((id) => id !== field)
        this.#announce()
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
        this.#announce()
    })

    removeValue = mutator((at: number): void => {
        this.values = this.values.filter((_measure, index) => index !== at)
        this.#announce()
    })

    setValueAgg = mutator((at: number, agg: Aggregation<TRow>): void => {
        this.values = this.values.map((measure, index) =>
            index === at ? { ...measure, agg } : measure
        )
        this.#announce()
    })

    setValueShowAs = mutator((at: number, showAs: PivotShowAs | undefined): void => {
        this.values = this.values.map((measure, index) =>
            index === at ? { ...measure, showAs } : measure
        )
    })

    expandAllRows = (): void => {
        const expansion = this.#grid.expansion
        let opened: string[] = []

        for (let tier = 1; tier < Math.max(2, this.rows.length); tier++) {
            opened = [...opened, ...this.#openable()]
            expansion.expandAll(opened)
        }
    }

    #openable(): string[] {
        return this.#grid.preWindowNodes
            .filter((node) => node.meta?.expandable)
            .map((node) => node.id)
    }

    collapseAllRows = (): void => {
        this.#grid.expansion.collapseAll()
    }

    get rowsOpen(): boolean {
        return this.#grid.preWindowNodes.some(
            (node) => node.meta?.expandable && this.#grid.expansion.isExpanded(node.id)
        )
    }

    clearPivot = mutator((): void => {
        this.rows = []
        this.columns = []
        this.#announce()
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
        return crossingMeasures(all, {
            grid: this.#grid,
            values: this.values,
            columnDefs: this.#columnDefs(),
            crossing: this.#crossing,
            onRows: this.#onRows,
            totalColumn: this.totalColumn,
            columnSubtotal: this.columnSubtotal,
            warnRunning: () => this.#warnRunning()
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
    #gateWarned = false

    #warnIfGated(): void {
        const gated = this.#grid.features.some(
            (feature) => feature.cellValue !== undefined && feature.id !== PIVOT
        )
        if (!gated || this.#gateWarned) return
        this.#gateWarned = true
        // eslint-disable-next-line no-console
        console.warn(DRILL_PAST_A_GATE)
    }

    rowsBehind(node: RowNode<TRow>, columnId: string): TRow[] {
        const ref = this.#index.get(columnId)
        if (!ref || !this.isCrossing) return []
        this.#warnIfGated()

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
