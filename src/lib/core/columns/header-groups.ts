import type { ColumnDef, ColumnState, HeaderGroupCell } from '../types/index.js'

export function flattenColumns<TRow>(defs: ColumnDef<TRow>[]): ColumnDef<TRow>[] {
    return defs.flatMap((def) => (def.children?.length ? flattenColumns(def.children) : [def]))
}

export function buildGroupPaths<TRow>(defs: ColumnDef<TRow>[]): Map<string, ColumnDef<TRow>[]> {
    const paths = new Map<string, ColumnDef<TRow>[]>()

    function walk(nodes: ColumnDef<TRow>[], ancestors: ColumnDef<TRow>[]) {
        for (const node of nodes) {
            if (node.children?.length) {
                walk(node.children, [...ancestors, node])
            } else {
                paths.set(node.id, ancestors)
            }
        }
    }

    walk(defs, [])
    return paths
}

/** Every group in the tree, for a snapshot that keys its state by group. */
export function groupIdsOf<TRow>(defs: ColumnDef<TRow>[]): string[] {
    return defs.flatMap((def) =>
        def.children?.length ? [def.id, ...groupIdsOf(def.children)] : []
    )
}

/**
 * Whether a collapsed group folds this leaf away.
 *
 * Each group answers for its own children and no further: `columnGroupShow`
 * on a node is read against the group directly above that node, so a nested
 * group's children fold with the nested group rather than with the outer one.
 */
export function hiddenByCollapse<TRow>(
    ancestors: ColumnDef<TRow>[],
    leaf: ColumnDef<TRow>,
    isCollapsed: (groupId: string) => boolean
): boolean {
    for (let level = 0; level < ancestors.length; level++) {
        const group = ancestors[level]!
        const collapsed = isCollapsed(group.id)
        // A group folding to a rail takes everything under it, whatever the
        // columns say for themselves: the strip is what stands in for them.
        if (collapsed && group.collapseMode === 'rail') return true

        // The node this group holds on the way down to the leaf.
        const child = ancestors[level + 1] ?? leaf
        const show = child.columnGroupShow
        if (!show) continue
        if (show === (collapsed ? 'open' : 'closed')) return true
    }
    return false
}

/**
 * Groups that can fold at all: one a child asks to fold by declaring
 * `columnGroupShow`, and one that folds to a rail, which needs no such
 * declaration because the rail is what unfolds it.
 */
export function foldableGroupIds<TRow>(defs: ColumnDef<TRow>[]): Set<string> {
    const ids = new Set<string>()

    function walk(nodes: ColumnDef<TRow>[]) {
        for (const node of nodes) {
            if (!node.children?.length) continue
            const folds =
                node.collapseMode === 'rail' || node.children.some((child) => child.columnGroupShow)
            if (folds) ids.add(node.id)
            walk(node.children)
        }
    }

    walk(defs)
    return ids
}

/** Leaves by id, for the lookups the collapse rules need per column. */
export function leafDefsById<TRow>(leaves: ColumnDef<TRow>[]): Map<string, ColumnDef<TRow>> {
    return new Map(leaves.map((def) => [def.id, def]))
}

/** Group nodes by id, for a group's own starting state and its header. */
export function groupDefsById<TRow>(defs: ColumnDef<TRow>[]): Map<string, ColumnDef<TRow>> {
    const groups = new Map<string, ColumnDef<TRow>>()

    function walk(nodes: ColumnDef<TRow>[]) {
        for (const node of nodes) {
            if (!node.children?.length) continue
            groups.set(node.id, node)
            walk(node.children)
        }
    }

    walk(defs)
    return groups
}

/** The leaves each group holds, however deep they sit under it. */
export function leafIdsByGroup<TRow>(paths: Map<string, ColumnDef<TRow>[]>): Map<string, string[]> {
    const byGroup = new Map<string, string[]>()
    for (const [leafId, ancestors] of paths) {
        for (const group of ancestors) {
            const leaves = byGroup.get(group.id)
            if (leaves) leaves.push(leafId)
            else byGroup.set(group.id, [leafId])
        }
    }
    return byGroup
}

export function parentGroupIdOf<TRow>(
    paths: Map<string, ColumnDef<TRow>[]>,
    leafId: string
): string | null {
    const path = paths.get(leafId)
    return path?.length ? path[path.length - 1].id : null
}

function canJoin<TRow>(
    previous: HeaderGroupCell | undefined,
    group: ColumnDef<TRow> | undefined,
    column: ColumnState<TRow>,
    index: number
): previous is HeaderGroupCell {
    if (!previous) return false
    if (previous.start + previous.span !== index) return false
    if (previous.pinned !== column.pinned) return false
    if (group) return !previous.isPlaceholder && previous.id === group.id
    return previous.isPlaceholder
}

/** What a group offers the header: a toggle, and the state it is in. */
export interface GroupToggle {
    collapsible: boolean
    collapsed: boolean
}

interface LevelCellContext<TRow> {
    group: ColumnDef<TRow> | undefined
    column: ColumnState<TRow>
    level: number
    index: number
    toggles: Map<string, GroupToggle> | undefined
}

function createLevelCell<TRow>({
    group,
    column,
    level,
    index,
    toggles
}: LevelCellContext<TRow>): HeaderGroupCell {
    const toggle = group ? toggles?.get(group.id) : undefined
    return {
        id: group ? group.id : `placeholder-${level}-${index}`,
        header: group ? (group.header ?? group.id) : '',
        start: index,
        span: 1,
        isPlaceholder: !group,
        leafIds: [column.id],
        pinned: column.pinned,
        collapsible: toggle?.collapsible ?? false,
        collapsed: toggle?.collapsed ?? false
    }
}

export function groupBoundaries(levels: HeaderGroupCell[][], columnCount: number): boolean[] {
    const flags = new Array<boolean>(columnCount).fill(false)
    const topLevel = levels[0]
    if (!topLevel) return flags

    for (const cell of topLevel) {
        const end = cell.start + cell.span - 1
        if (end < columnCount - 1) flags[end] = true
    }
    return flags
}

export function buildHeaderLevels<TRow>(
    visible: ColumnState<TRow>[],
    paths: Map<string, ColumnDef<TRow>[]>,
    toggles?: Map<string, GroupToggle>
): HeaderGroupCell[][] {
    const depth = Math.max(0, ...visible.map((column) => paths.get(column.id)?.length ?? 0))
    if (depth === 0) return []

    const levels: HeaderGroupCell[][] = []
    for (let level = 0; level < depth; level++) {
        const cells: HeaderGroupCell[] = []
        visible.forEach((column, index) => {
            const group = paths.get(column.id)?.[level]
            const previous = cells[cells.length - 1]

            if (canJoin(previous, group, column, index)) {
                previous.span += 1
                previous.leafIds.push(column.id)
            } else {
                cells.push(createLevelCell({ group, column, level, index, toggles }))
            }
        })
        levels.push(cells)
    }
    return levels
}

/** What a leaf answers to, for the simulation below. */
export interface CollapseContext<TRow> {
    paths: Map<string, ColumnDef<TRow>[]>
    leaves: Map<string, ColumnDef<TRow>>
    leafIdsByGroup: Map<string, string[]>
    /** Whether the user put this column away, group or no group. */
    isHidden: (def: ColumnDef<TRow>) => boolean
    isCollapsed: (groupId: string) => boolean
    /** Whether this group folds to a rail rather than to a summary column. */
    isRail: (groupId: string) => boolean
}

/**
 * What each foldable group offers the header.
 *
 * A toggle is offered only when the state it would switch to leaves a column
 * of that group on screen. A group that folded itself away entirely would take
 * its own header cell with it, and nothing would be left to click to bring it
 * back; so would one whose summary column the user has already put away.
 */
export function buildGroupToggles<TRow>(
    defs: ColumnDef<TRow>[],
    context: CollapseContext<TRow>
): Map<string, GroupToggle> {
    const toggles = new Map<string, GroupToggle>()

    for (const groupId of foldableGroupIds(defs)) {
        const collapsed = context.isCollapsed(groupId)
        // A rail leaves a strip behind, so it can always be folded back open.
        if (context.isRail(groupId)) {
            toggles.set(groupId, { collapsed, collapsible: true })
            continue
        }
        const wouldBe = (id: string) => (id === groupId ? !collapsed : context.isCollapsed(id))
        const survives = (context.leafIdsByGroup.get(groupId) ?? []).some((leafId) => {
            const def = context.leaves.get(leafId)
            if (!def || context.isHidden(def)) return false
            return !hiddenByCollapse(context.paths.get(leafId) ?? [], def, wouldBe)
        })
        toggles.set(groupId, { collapsed, collapsible: survives })
    }

    return toggles
}

/**
 * The declared paths, plus one for every rail standing in for a folded group.
 * A rail belongs to the group it stands for, so the header still draws that
 * group over it, and the control in that cell is what unfolds it again.
 */
export function withRailPaths<TRow>(
    declared: Map<string, ColumnDef<TRow>[]>,
    railed: ColumnDef<TRow>[],
    railIdOf: (groupId: string) => string
): Map<string, ColumnDef<TRow>[]> {
    if (railed.length === 0) return declared

    const paths = new Map(declared)
    for (const group of railed) {
        for (const ancestors of declared.values()) {
            const at = ancestors.indexOf(group)
            if (at < 0) continue
            paths.set(railIdOf(group.id), ancestors.slice(0, at + 1))
            break
        }
    }
    return paths
}

/** One column the grid will draw: a declared leaf, or a group as its rail. */
export interface OrderedSlot<TRow> {
    /** The leaf, or the group a rail stands for. */
    def: ColumnDef<TRow>
    /** The leaf whose pin side the rail takes; the leaf itself otherwise. */
    pinFrom: ColumnDef<TRow>
    rail: boolean
}

/**
 * The ordered leaves, with the ones a folded rail covers replaced by that
 * rail. The rail lands where its group's first leaf stood, so a fold moves
 * nothing else along the row.
 */
export function withRails<TRow>(
    ordered: ColumnDef<TRow>[],
    railOver: (leafId: string) => ColumnDef<TRow> | undefined
): OrderedSlot<TRow>[] {
    const slots: OrderedSlot<TRow>[] = []
    const drawn = new Set<string>()

    for (const def of ordered) {
        const group = railOver(def.id)
        if (!group) {
            slots.push({ def, pinFrom: def, rail: false })
            continue
        }
        if (drawn.has(group.id)) continue
        drawn.add(group.id)
        slots.push({ def: group, pinFrom: def, rail: true })
    }

    return slots
}
