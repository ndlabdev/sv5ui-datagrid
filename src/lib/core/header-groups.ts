import type { ColumnDef, ColumnState, HeaderGroupCell } from './types.js'

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

function createLevelCell<TRow>(
    group: ColumnDef<TRow> | undefined,
    column: ColumnState<TRow>,
    level: number,
    index: number
): HeaderGroupCell {
    return {
        id: group ? group.id : `placeholder-${level}-${index}`,
        header: group ? (group.header ?? group.id) : '',
        start: index,
        span: 1,
        isPlaceholder: !group,
        leafIds: [column.id],
        pinned: column.pinned
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
    paths: Map<string, ColumnDef<TRow>[]>
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
                cells.push(createLevelCell(group, column, level, index))
            }
        })
        levels.push(cells)
    }
    return levels
}
