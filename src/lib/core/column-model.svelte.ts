import {
    buildColumnCssVars,
    createColumnState,
    pinOffsets,
    prefixSums,
    resolveColumnWidths,
    toStyleString,
    trackWidthEstimates
} from './column-sizing.js'
import { orderLeafDefs, sanitizeColumnState } from './column-order.js'
import {
    buildGroupPaths,
    buildHeaderLevels,
    flattenColumns,
    groupBoundaries
} from './header-groups.js'
import { clamp } from './math.js'
import {
    SELECTION_COLUMN_ID,
    type ColumnDef,
    type ColumnState,
    type ColumnStateSnapshot,
    type PinnedSide
} from './types.js'

const SELECTION_COLUMN_WIDTH = 44

const selectionColumnDef: ColumnDef<unknown> = {
    id: SELECTION_COLUMN_ID,
    header: '',
    width: SELECTION_COLUMN_WIDTH,
    minWidth: SELECTION_COLUMN_WIDTH,
    maxWidth: SELECTION_COLUMN_WIDTH,
    align: 'center',
    pinned: 'left'
}

export class ColumnModel<TRow> {
    defs = $state.raw<ColumnDef<TRow>[]>([])
    containerWidth = $state(0)
    selectionColumn = $state(false)

    orderIds = $state.raw<string[]>([])
    widthOverrides = $state.raw<Record<string, number>>({})
    hiddenOverrides = $state.raw<Record<string, boolean>>({})
    pinnedOverrides = $state.raw<Record<string, PinnedSide | null>>({})

    leafDefs = $derived.by(() => flattenColumns(this.defs))
    groupPaths = $derived.by(() => buildGroupPaths(this.defs))

    all = $derived.by(() => {
        const ordered = orderLeafDefs(this.leafDefs, this.orderIds)
        const states = ordered.map((def) =>
            createColumnState(def, {
                hidden: this.hiddenOverrides[def.id],
                pinned: this.pinnedOverrides[def.id]
            })
        )
        const lead = this.selectionColumn
            ? [createColumnState(selectionColumnDef as ColumnDef<TRow>)]
            : []
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

    headerLevels = $derived.by(() => buildHeaderLevels(this.visible, this.groupPaths))
    headerRowCount = $derived(this.headerLevels.length + 1)
    groupBoundaryFlags = $derived.by(() => groupBoundaries(this.headerLevels, this.visible.length))

    constructor(defs: ColumnDef<TRow>[]) {
        this.defs = defs
    }

    get(id: string): ColumnState<TRow> | undefined {
        return this.all.find((column) => column.id === id)
    }

    indexOf(id: string): number {
        return this.visible.findIndex((column) => column.id === id)
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

    moveColumn(id: string, toIndex: number): number {
        if (id === SELECTION_COLUMN_ID) return -1
        const order = this.all.map((column) => column.id)
        const from = order.indexOf(id)
        if (from < 0) return -1
        const min = this.selectionColumn ? 1 : 0
        const target = clamp(toIndex, min, order.length - 1)
        order.splice(from, 1)
        order.splice(target, 0, id)
        this.orderIds = order.filter((columnId) => columnId !== SELECTION_COLUMN_ID)
        return target
    }

    setPinned(id: string, side: PinnedSide | null): void {
        if (id === SELECTION_COLUMN_ID || !this.get(id)) return
        this.pinnedOverrides = { ...this.pinnedOverrides, [id]: side }
    }

    setHidden(id: string, hidden: boolean): void {
        if (id === SELECTION_COLUMN_ID || !this.get(id)) return
        this.hiddenOverrides = { ...this.hiddenOverrides, [id]: hidden }
    }

    columnState(): ColumnStateSnapshot {
        return {
            order: this.all.map((column) => column.id).filter((id) => id !== SELECTION_COLUMN_ID),
            widths: { ...this.widthOverrides },
            hidden: { ...this.hiddenOverrides },
            pinned: { ...this.pinnedOverrides }
        }
    }

    applyColumnState(snapshot: ColumnStateSnapshot): void {
        const sanitized = sanitizeColumnState(
            snapshot,
            this.leafDefs.map((def) => def.id)
        )
        this.orderIds = sanitized.order
        this.widthOverrides = sanitized.widths
        this.hiddenOverrides = sanitized.hidden
        this.pinnedOverrides = sanitized.pinned
    }
}
