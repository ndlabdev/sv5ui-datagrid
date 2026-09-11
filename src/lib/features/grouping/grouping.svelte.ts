import { gateReader, type GridState, PIPELINE_ORDER } from '../../core/grid/index.js'
import {
    type GridFeature,
    type MenuContext,
    type MenuItem,
    type RowNode,
    SELECTION_COLUMN_ID
} from '../../core/types/index.js'
import { buildGroupNodes } from './group-nodes.js'
import { buildGrandTotalNode, totalsKindOf } from './totals-nodes.js'
import { createSeenGroups } from './seen-groups.js'
import type { Aggregation, GroupingOptions } from './grouping.types.js'

const GROUPING = 'grouping'

const defaultLabel = (key: string, count: number): string => `${key} (${count})`

const SERVER_SCOPE =
    'grouping() on rowModel: "server" groups the rows the client has loaded, not the dataset. ' +
    'Every count and aggregate it shows is scoped to those rows, and the labels say so. ' +
    'Group on the server with serverRowModel({ groupBy }) when the numbers have to be complete.'

export class Grouping<TRow> {
    by = $state.raw<string[]>([])

    aggregations = $state.raw<Record<string, Aggregation<TRow>>>({})
    readonly expandedByDefault: boolean
    #groupLabel?: (key: string, count: number, columnId: string) => string
    readonly groupFooters: boolean
    readonly grandTotal: boolean

    #footerLabel?: (key: string, count: number, columnId: string) => string
    #grandTotalLabel?: (count: number) => string

    #grid: GridState<TRow>
    #seen = createSeenGroups()

    constructor(grid: GridState<TRow>, options: GroupingOptions<TRow>) {
        this.#grid = grid
        this.by = options.by ?? []
        this.aggregations = options.aggregations ?? {}
        this.expandedByDefault = options.expandedByDefault ?? true
        this.#groupLabel = options.groupLabel
        this.groupFooters = options.groupFooters ?? false
        this.#footerLabel = options.footerLabel
        this.grandTotal = options.grandTotal ?? false
        this.#grandTotalLabel = options.grandTotalLabel
    }

    get isPartial(): boolean {
        return this.#grid.rowModel === 'server'
    }

    #scopeWarned = false

    #scoped(): boolean {
        if (!this.isPartial) return false
        if (!this.#scopeWarned) {
            this.#scopeWarned = true
            // eslint-disable-next-line no-console
            console.warn(SERVER_SCOPE)
        }
        return true
    }

    groupLabel = (key: string, count: number, columnId: string): string => {
        if (this.#groupLabel) return this.#groupLabel(key, count, columnId)
        const labels = this.#grid.labels
        return this.#scoped() ? labels.groupLoaded(key, count) : defaultLabel(key, count)
    }

    footerLabel = (key: string, count: number, columnId: string): string => {
        if (this.#footerLabel) return this.#footerLabel(key, count, columnId)
        const labels = this.#grid.labels
        return this.#scoped()
            ? labels.groupFooterLoaded(key, count)
            : labels.groupFooter(key, count)
    }

    grandTotalLabel = (count: number): string => {
        if (this.#grandTotalLabel) return this.#grandTotalLabel(count)
        const labels = this.#grid.labels
        return this.#scoped() ? labels.grandTotalLoaded(count) : labels.grandTotal(count)
    }

    get isGrouped(): boolean {
        return this.by.length > 0
    }

    isGroupedBy(columnId: string): boolean {
        return this.by.includes(columnId)
    }

    groupableColumns(): { id: string; header: string }[] {
        return this.#grid.columns.visible
            .filter((column) => !this.by.includes(column.id))
            .map((column) => ({ id: column.id, header: column.header }))
    }

    setGroupBy = (columnIds: string[]): void => {
        this.by = [...columnIds]
    }

    groupBy = (columnId: string): void => {
        if (this.by.includes(columnId)) return
        this.by = [...this.by, columnId]
    }

    ungroup = (columnId: string): void => {
        this.by = this.by.filter((id) => id !== columnId)
    }

    moveGroup = (columnId: string, offset: number): void => {
        const from = this.by.indexOf(columnId)
        if (from < 0) return
        const to = from + offset
        if (to < 0 || to >= this.by.length) return
        const next = [...this.by]
        next.splice(from, 1)
        next.splice(to, 0, columnId)
        this.by = next
    }

    clearGrouping = (): void => {
        this.by = []
    }

    expandAllGroups = (): void => {
        const expansion = this.#grid.expansion
        for (let level = 0; level < Math.max(1, this.by.length); level++) {
            const ids = this.#grid.preWindowNodes
                .filter((node) => node.meta?.expandable)
                .map((node) => node.id)
            expansion.expandAll([...expansion.expandedIds, ...ids])
        }
    }

    collapseAllGroups = (): void => {
        this.#grid.expansion.collapseAll()
    }

    setAggregation = (columnId: string, aggregation: Aggregation<TRow> | null): void => {
        const next = { ...this.aggregations }
        if (aggregation === null) delete next[columnId]
        else next[columnId] = aggregation
        this.aggregations = next
    }

    buildNodes = (nodes: RowNode<TRow>[]): RowNode<TRow>[] => {
        const pending: string[] = []

        const result = buildGroupNodes(nodes, {
            read: gateReader(this.#grid, 'render'),
            by: this.by,
            columns: this.#grid.columns.all.map((column) => column.def),
            aggregations: this.aggregations,
            isExpanded: (groupId) => {
                if (this.#grid.expansion.isExpanded(groupId)) return true
                if (!this.expandedByDefault || this.#seen.has(groupId)) return false
                pending.push(groupId)
                return true
            },
            groupLabel: this.groupLabel,
            footerLabel: this.groupFooters ? this.footerLabel : undefined
        })

        if (pending.length > 0) {
            const expansion = this.#grid.expansion
            queueMicrotask(() => {
                for (const id of pending) this.#seen.add(id)
                expansion.expandAll([...expansion.expandedIds, ...pending])
            })
        }
        return result
    }

    grandTotalNode = (leaves: RowNode<TRow>[]): RowNode<TRow> => {
        const labelColumnId =
            this.by[0] ??
            this.#grid.columns.visible.find(
                (column) => column.id !== SELECTION_COLUMN_ID && !(column.id in this.aggregations)
            )?.id

        return buildGrandTotalNode(leaves, {
            read: gateReader(this.#grid, 'render'),
            columns: this.#grid.columns.all.map((column) => column.def),
            aggregations: this.aggregations,
            labelColumnId,
            grandTotalLabel: this.grandTotalLabel
        })
    }
}

function createMenuItems<TRow>(ctx: MenuContext<TRow>): MenuItem[] {
    const state = getGrouping(ctx.grid)
    const columnId = ctx.columnId
    if (!state || !columnId) return []

    if (state.isGroupedBy(columnId)) {
        return [
            {
                id: 'ungroup-column',
                label: ctx.grid.labels.ungroupColumn,
                icon: 'lucide:ungroup',
                onSelect: () => state.ungroup(columnId)
            }
        ]
    }
    return [
        {
            id: 'group-by-column',
            label: ctx.grid.labels.groupByColumn,
            icon: 'lucide:group',
            onSelect: () => state.groupBy(columnId)
        }
    ]
}

export function grouping<TRow>(options: GroupingOptions<TRow> = {}): GridFeature<TRow> {
    return {
        id: GROUPING,
        createState: (grid) => {
            grid.expansion.enabled = true
            return new Grouping(grid, options)
        },
        createApi: (grid) => {
            const state = getGrouping(grid)!
            return {
                groupBy: state.groupBy,
                ungroup: state.ungroup,
                setGroupBy: state.setGroupBy,
                clearGrouping: state.clearGrouping,
                expandAllGroups: state.expandAllGroups,
                collapseAllGroups: state.collapseAllGroups,
                isGroupingPartial: () => state.isPartial,
                setAggregation: (columnId: string, aggregation: unknown) =>
                    state.setAggregation(columnId, aggregation as Aggregation<TRow> | null),
                getAggregations: () => state.aggregations
            }
        },
        menuItems: createMenuItems,
        serialize: (grid) => {
            const by = getGrouping(grid)?.by ?? []
            return by.length > 0 ? { by } : undefined
        },
        hydrate: (slice, grid) => {
            const state = getGrouping(grid)
            if (!state || typeof slice !== 'object' || slice === null) return
            const by = (slice as { by?: unknown }).by
            if (!Array.isArray(by)) return
            state.setGroupBy(
                by.filter(
                    (columnId): columnId is string =>
                        typeof columnId === 'string' && grid.columns.get(columnId) !== undefined
                )
            )
        },
        pipelineStage: {
            order: PIPELINE_ORDER.group,
            transform: (nodes, grid) => {
                const state = getGrouping(grid)
                if (!state) return nodes
                const grouped = state.isGrouped ? state.buildNodes(nodes) : nodes
                if (!state.grandTotal || nodes.length === 0) return grouped
                return [...grouped, state.grandTotalNode(nodes)]
            }
        },
        cellDecoration: (ctx) => {
            const kind = totalsKindOf(ctx.node.id)
            if (kind === 'footer') {
                return { class: 'bg-surface-container/40 font-medium' }
            }
            if (kind === 'grandTotal') {
                return {
                    class: 'border-t border-outline-variant bg-surface-container/60 font-semibold'
                }
            }
            return undefined
        }
    }
}

export function getGrouping<TRow>(grid: GridState<TRow>): Grouping<TRow> | undefined {
    return grid.feature<Grouping<TRow>>(GROUPING)
}

declare module '../../core/types/api.js' {
    interface GridApi {
        groupBy?: (columnId: string) => void
        ungroup?: (columnId: string) => void
        setGroupBy?: (columnIds: string[]) => void
        clearGrouping?: () => void
        expandAllGroups?: () => void
        collapseAllGroups?: () => void
        isGroupingPartial?: () => boolean
        setAggregation?: (columnId: string, aggregation: unknown) => void
        getAggregations?: () => Record<string, unknown>
    }
}
