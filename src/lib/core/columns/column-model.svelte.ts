import {
    buildColumnCssVars,
    createColumnState,
    pinOffsets,
    prefixSums,
    resolveColumnWidths,
    toStyleString,
    trackWidthEstimates
} from './column-sizing.js'
import {
    columnIndexById,
    columnsById,
    groupContiguousOrder,
    orderLeafDefs
} from './column-order.js'
import {
    buildGroupPaths,
    buildHeaderLevels,
    flattenColumns,
    groupBoundaries,
    parentGroupIdOf
} from './header-groups.js'
import { clamp } from '../utils/math.js'
import {
    isSyntheticColumn,
    ROW_HANDLE_COLUMN_ID,
    SELECTION_COLUMN_ID,
    type ColumnDef,
    type ColumnState,
    type PinnedSide
} from '../types/index.js'

const SYNTHETIC_COLUMN_WIDTH = 44

/** The grid's own columns: fixed width, pinned left, never resized or moved. */
function syntheticColumnDef(id: string): ColumnDef<unknown> {
    return {
        id,
        header: '',
        width: SYNTHETIC_COLUMN_WIDTH,
        minWidth: SYNTHETIC_COLUMN_WIDTH,
        maxWidth: SYNTHETIC_COLUMN_WIDTH,
        align: 'center',
        pinned: 'left',
        resizable: false
    }
}

const selectionColumnDef = syntheticColumnDef(SELECTION_COLUMN_ID)
const rowHandleColumnDef = syntheticColumnDef(ROW_HANDLE_COLUMN_ID)

export class ColumnModel<TRow> {
    defs = $state.raw<ColumnDef<TRow>[]>([])
    containerWidth = $state(0)
    selectionColumn = $state(false)
    rowHandleColumn = $state(false)

    orderIds = $state.raw<string[]>([])
    widthOverrides = $state.raw<Record<string, number>>({})
    hiddenOverrides = $state.raw<Record<string, boolean>>({})
    pinnedOverrides = $state.raw<Record<string, PinnedSide | null>>({})

    leafDefs = $derived.by(() => flattenColumns(this.defs))
    groupPaths = $derived.by(() => buildGroupPaths(this.defs))

    all = $derived.by(() => {
        // Applied here rather than at the `setState` boundary so every route
        // into `orderIds` gets the same guarantee.
        const requested = groupContiguousOrder(this.orderIds, (leafId) =>
            parentGroupIdOf(this.groupPaths, leafId)
        )
        const ordered = orderLeafDefs(this.leafDefs, requested)
        const states = ordered.map((def) =>
            createColumnState(def, {
                hidden: this.hiddenOverrides[def.id],
                pinned: this.pinnedOverrides[def.id]
            })
        )
        // The grip sits outside the checkbox so dragging never toggles a row.
        const lead: ColumnState<TRow>[] = []
        if (this.rowHandleColumn) {
            lead.push(createColumnState(rowHandleColumnDef as ColumnDef<TRow>))
        }
        if (this.selectionColumn) {
            lead.push(createColumnState(selectionColumnDef as ColumnDef<TRow>))
        }
        return [
            ...lead,
            ...states.filter((column) => column.pinned === 'left'),
            ...states.filter((column) => column.pinned === null),
            ...states.filter((column) => column.pinned === 'right')
        ]
    })

    visible = $derived(this.all.filter((column) => !column.hidden))
    pinnedLeft = $derived(this.visible.filter((column) => column.pinned === 'left'))
    center = $derived(this.visible.filter((column) => column.pinned === null))
    pinnedRight = $derived(this.visible.filter((column) => column.pinned === 'right'))

    resolvedWidths = $derived.by(() => {
        if (this.containerWidth <= 0) return null
        return resolveColumnWidths(this.visible, this.containerWidth, this.widthOverrides)
    })
    trackWidths = $derived.by(() =>
        trackWidthEstimates(this.visible, this.resolvedWidths, this.widthOverrides)
    )
    offsets = $derived.by(() => (this.resolvedWidths ? prefixSums(this.resolvedWidths) : null))
    pins = $derived.by(() => pinOffsets(this.visible, this.trackWidths))
    cssVars = $derived(
        buildColumnCssVars(this.visible, this.resolvedWidths, this.pins, this.widthOverrides)
    )
    style = $derived(toStyleString(this.cssVars))

    #byId = $derived(columnsById(this.all))
    #visibleIndex = $derived(columnIndexById(this.visible))

    headerLevels = $derived.by(() => buildHeaderLevels(this.visible, this.groupPaths))
    headerRowCount = $derived(this.headerLevels.length + 1)
    groupBoundaryFlags = $derived.by(() => groupBoundaries(this.headerLevels, this.visible.length))

    constructor(defs: ColumnDef<TRow>[]) {
        this.defs = defs
    }

    get(id: string): ColumnState<TRow> | undefined {
        return this.#byId.get(id)
    }

    indexOf(id: string): number {
        return this.#visibleIndex.get(id) ?? -1
    }

    widthOf(id: string): number | undefined {
        return this.widthOverrides[id] ?? this.get(id)?.width
    }

    setWidth(id: string, width: number): number {
        const column = this.get(id)
        if (!column) return 0
        const clamped = Math.round(clamp(width, column.minWidth, column.maxWidth))
        this.widthOverrides = { ...this.widthOverrides, [id]: clamped }
        return clamped
    }

    setWidths(widths: Record<string, number>): void {
        const next = { ...this.widthOverrides }
        for (const [id, width] of Object.entries(widths)) {
            const column = this.get(id)
            if (column) next[id] = Math.round(clamp(width, column.minWidth, column.maxWidth))
        }
        this.widthOverrides = next
    }

    /** How many synthetic columns lead the row; nothing may move before them. */
    get #leadCount(): number {
        return (this.rowHandleColumn ? 1 : 0) + (this.selectionColumn ? 1 : 0)
    }

    moveColumn(id: string, toIndex: number): number {
        if (isSyntheticColumn(id)) return -1
        const order = this.all.map((column) => column.id)
        const from = order.indexOf(id)
        if (from < 0) return -1
        const target = clamp(toIndex, this.#leadCount, order.length - 1)
        order.splice(from, 1)
        order.splice(target, 0, id)
        this.orderIds = order.filter((columnId) => !isSyntheticColumn(columnId))
        return target
    }

    setPinned(id: string, side: PinnedSide | null): void {
        if (isSyntheticColumn(id) || !this.get(id)) return
        this.pinnedOverrides = { ...this.pinnedOverrides, [id]: side }
    }

    setHidden(id: string, hidden: boolean): void {
        if (isSyntheticColumn(id) || !this.get(id)) return
        this.hiddenOverrides = { ...this.hiddenOverrides, [id]: hidden }
    }
}
