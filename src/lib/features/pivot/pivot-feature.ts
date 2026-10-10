import { PIPELINE_ORDER } from '../../core/grid/index.js'
import type { GridFeature, MenuContext, MenuItem, RowNode } from '../../core/types/index.js'
import { totalsKindOf } from '../grouping/totals-nodes.js'
import { isPivotColumn, measureRowBase } from './pivot-ids.js'
import { getPivot, PIVOT, Pivot } from './pivot.svelte.js'
import { hydratePivot, serializePivot } from './pivot-snapshot.js'
import type {
    PivotKeepRows,
    PivotOptions,
    PivotMeasure,
    PivotOrderColumns,
    PivotValuesOn
} from './pivot.types.js'

const CROSSED = Object.freeze({})

const refuseEditing = (): unknown => CROSSED

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
                expandAllPivotRows: state.expandAllRows,
                collapseAllPivotRows: state.collapseAllRows,
                pivotRowsOpen: () => state.rowsOpen,
                isPivoting: () => state.isCrossing
            }
        },
        menuItems: pivotMenuItems,
        serialize: (grid) => {
            const state = getPivot(grid)
            return state ? serializePivot(state) : undefined
        },
        hydrate: (slice, grid) => {
            const state = getPivot(grid)
            if (state) hydratePivot(state, slice, grid)
        },
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
        pivotRowsBehind?: (node: RowNode<unknown>, columnId: string) => unknown[]
        setPivotTotalColumn?: (header: string | undefined) => void
        setPivotTotalRow?: (header: string | undefined) => void
        setPivotColumnGroups?: (mode: 'fixed' | 'open' | 'closed') => void
        setPivotColumnSubtotal?: (label: ((header: string) => string) | undefined) => void
        setPivotSortableColumns?: (sortable: boolean) => void
        setPivotValuesOn?: (where: PivotValuesOn) => void
        setPivotKeepRows?: (keep: PivotKeepRows | undefined) => void
        pivotKeepRows?: () => PivotKeepRows | undefined
        setPivotOrderColumns?: (order: PivotOrderColumns | undefined) => void
        pivotOrderColumns?: () => PivotOrderColumns | undefined
        pivotValuesOn?: () => PivotValuesOn
        pivotRows?: () => string[]
        pivotColumns?: () => string[]
        pivotValues?: () => unknown[]
        setPivotMaxColumns?: (limit: number) => void
        pivotMaxColumns?: () => number
        expandAllPivotRows?: () => void
        collapseAllPivotRows?: () => void
        pivotRowsOpen?: () => boolean
        isPivoting?: () => boolean
    }
}
