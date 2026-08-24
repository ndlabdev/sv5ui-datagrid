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
    buildGroupToggles,
    buildHeaderLevels,
    flattenColumns,
    groupBoundaries,
    groupDefsById,
    hiddenByCollapse,
    leafDefsById,
    leafIdsByGroup,
    parentGroupIdOf,
    withRailPaths,
    withRails
} from './header-groups.js'
import { clamp } from '../utils/math.js'
import {
    isSyntheticColumn,
    railColumnId,
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

/**
 * The strip a railed group leaves behind: narrow, fixed, and unmovable, and
 * pinned only where the columns it stands for were. The other synthetic
 * columns lead the row and pin left for that reason; a rail stands where its
 * group stood.
 */
function railColumnDef(groupId: string, header: string): ColumnDef<unknown> {
    return { ...syntheticColumnDef(railColumnId(groupId)), header, pinned: undefined }
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
    /**
     * Columns the user put away, and the groups the user folded. Two records
     * rather than one: a column folded away with its group is not one the
     * Column chooser should show as unticked, and ticking it there would open
     * a single column in the middle of a closed group.
     */
    hiddenOverrides = $state.raw<Record<string, boolean>>({})
    collapsedGroups = $state.raw<Record<string, boolean>>({})
    pinnedOverrides = $state.raw<Record<string, PinnedSide | null>>({})

    leafDefs = $derived.by(() => flattenColumns(this.defs))

    /** What the columns declare, before a rail stands in for any of them. */
    #declaredPaths = $derived.by(() => buildGroupPaths(this.defs))

    /**
     * The same, plus a path for every rail: a rail belongs to the group it
     * stands for, so the header still draws that group over it, and the
     * toggle in it is what unfolds the group again.
     */
    groupPaths = $derived.by(() =>
        withRailPaths(this.#declaredPaths, this.#railedGroups, railColumnId)
    )

    #leafById = $derived.by(() => leafDefsById(this.leafDefs))
    #groupById = $derived.by(() => groupDefsById(this.defs))
    #leafIdsByGroup = $derived.by(() => leafIdsByGroup(this.#declaredPaths))

    /** A group node by id, for what draws or names it. */
    groupDef(groupId: string): ColumnDef<TRow> | undefined {
        return this.#groupById.get(groupId)
    }

    /** The group's own starting state, with the user's answer over it. */
    isCollapsed(groupId: string): boolean {
        return this.collapsedGroups[groupId] ?? this.#groupById.get(groupId)?.collapsed ?? false
    }

    #userHidden(def: ColumnDef<TRow>): boolean {
        return this.hiddenOverrides[def.id] ?? def.hidden ?? false
    }

    /** What each foldable group offers the header. */
    groupToggles = $derived.by(() =>
        buildGroupToggles(this.defs, {
            paths: this.#declaredPaths,
            leaves: this.#leafById,
            leafIdsByGroup: this.#leafIdsByGroup,
            isHidden: (def) => this.#userHidden(def),
            isCollapsed: (groupId) => this.isCollapsed(groupId),
            isRail: (groupId) => this.isRail(groupId)
        })
    )

    /** Whether this group folds to a rail rather than to a summary column. */
    isRail(groupId: string): boolean {
        return this.#groupById.get(groupId)?.collapseMode === 'rail'
    }

    /** The groups standing folded as a rail right now, outermost first. */
    #railedGroups = $derived.by(() =>
        [...this.#groupById.values()].filter(
            (group) => group.collapseMode === 'rail' && this.isCollapsed(group.id)
        )
    )

    all = $derived.by(() => {
        // Applied here rather than at the `setState` boundary so every route
        // into `orderIds` gets the same guarantee.
        const requested = groupContiguousOrder(this.orderIds, (leafId) =>
            parentGroupIdOf(this.#declaredPaths, leafId)
        )
        const ordered = orderLeafDefs(this.leafDefs, requested)
        const states = withRails(ordered, (leafId) => this.#railOver(leafId)).map(
            ({ def, pinFrom, rail }) =>
                rail
                    ? createColumnState(
                          railColumnDef(def.id, def.header ?? def.id) as ColumnDef<TRow>,
                          { pinned: this.pinnedOverrides[pinFrom.id] ?? pinFrom.pinned ?? null }
                      )
                    : createColumnState(def, {
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

    /** The outermost railed group a column sits under, if any. */
    #railOver(leafId: string): ColumnDef<TRow> | undefined {
        if (this.#railedGroups.length === 0) return undefined
        const ancestors = this.groupPaths.get(leafId) ?? []
        return ancestors.find((group) => this.#railedGroups.includes(group))
    }

    /** Folded away with its group, which is not the same as put away. */
    #foldedAway(id: string): boolean {
        const def = this.#leafById.get(id)
        // A rail is not a declared column, and is drawn precisely because its
        // group is folded.
        if (!def) return false
        return hiddenByCollapse(this.#declaredPaths.get(id) ?? [], def, (groupId) =>
            this.isCollapsed(groupId)
        )
    }

    visible = $derived(this.all.filter((column) => !column.hidden && !this.#foldedAway(column.id)))
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

    headerLevels = $derived.by(() =>
        buildHeaderLevels(this.visible, this.groupPaths, this.groupToggles)
    )
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

    /** Folds or unfolds a group, when doing so leaves something to unfold. */
    setGroupCollapsed(groupId: string, collapsed: boolean): boolean {
        const toggle = this.groupToggles.get(groupId)
        if (!toggle || toggle.collapsed === collapsed || !toggle.collapsible) return false
        this.collapsedGroups = { ...this.collapsedGroups, [groupId]: collapsed }
        return true
    }

    toggleGroup(groupId: string): boolean {
        return this.setGroupCollapsed(groupId, !this.isCollapsed(groupId))
    }

    /** The group a column would fold with, nearest first, or none. */
    foldableGroupOf(columnId: string): ColumnDef<TRow> | undefined {
        const ancestors = this.groupPaths.get(columnId) ?? []
        for (let level = ancestors.length - 1; level >= 0; level--) {
            const group = ancestors[level]!
            if (this.groupToggles.get(group.id)?.collapsible) return group
        }
        return undefined
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
