import type { GridState } from '../../core/grid/index.js'
import type { ColumnType } from '../../core/types/index.js'
import type { ColumnGroupMode } from './pivot-columns.js'
import type { Pivot } from './pivot.svelte.js'
import type {
    PivotKeepRows,
    PivotMeasure,
    PivotOrderColumns,
    PivotShowAs,
    PivotValuesOn
} from './pivot.types.js'

const UNNAMED_SAVE =
    'pivot() left its measures out of the snapshot: one reduces with a function or a ' +
    'parameterised aggregation, and only the named ones survive being written down. The crossing ' +
    'is saved; the measures stay as the grid was built with.'

export function serializePivot<TRow>(state: Pivot<TRow>): unknown {
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

export function hydratePivot<TRow>(
    state: Pivot<TRow>,
    slice: unknown,
    grid: GridState<TRow>
): void {
    if (slice === null || typeof slice !== 'object') return

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
