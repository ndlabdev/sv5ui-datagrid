import { type ColumnDef, type RowNode } from '../../core/types/index.js'
import { type CellRead, markSyntheticRow, rawRead } from '../../core/grid/index.js'
import { aggregate } from './aggregate.js'
import type { Aggregation, GroupRowValues } from './grouping.types.js'

export function groupPathId(prefix: string, path: { columnId: string; key: string }[]): string {
    const parts = path.map(
        (part) => `${part.columnId}=${part.key.replaceAll('\\', '\\\\').replaceAll('|', '\\|')}`
    )
    return `${prefix}:${parts.join('|')}`
}

export function footerNodeId(path: { columnId: string; key: string }[]): string {
    return groupPathId('footer', path)
}

export const GRAND_TOTAL_ID = 'total:grand'

export function totalsKindOf(id: string): 'footer' | 'grandTotal' | null {
    if (id === GRAND_TOTAL_ID) return 'grandTotal'
    return id.startsWith('footer:') ? 'footer' : null
}

export function aggregateRowValues<TRow>(
    members: RowNode<TRow>[],
    columns: ColumnDef<TRow>[],
    aggregations: Record<string, Aggregation<TRow>>,
    read: CellRead<TRow> = rawRead
): GroupRowValues {
    const values: GroupRowValues = {}
    const rows = members.map((node) => node.row)
    for (const [columnId, aggregation] of Object.entries(aggregations)) {
        const column = columns.find((candidate) => candidate.id === columnId)
        const cells = column ? members.map((node) => read(node, column)) : []
        values[columnId] = aggregate(aggregation, cells, rows)
    }
    return values
}

interface BuildFooterNodeOptions<TRow> {
    read?: CellRead<TRow>
    columns: ColumnDef<TRow>[]

    aggregations: Record<string, Aggregation<TRow>>

    footerLabel: (key: string, count: number, columnId: string) => string
}

export function buildFooterNode<TRow>(
    path: { columnId: string; key: string }[],
    members: RowNode<TRow>[],
    level: number,
    options: BuildFooterNodeOptions<TRow>
): RowNode<TRow> {
    const { columnId, key } = path[path.length - 1]!
    const row = markSyntheticRow({
        ...aggregateRowValues(members, options.columns, options.aggregations, options.read),
        [columnId]: options.footerLabel(key, members.length, columnId)
    } as unknown as TRow)

    return {
        id: footerNodeId(path),
        row,
        index: members[0]!.index,
        meta: { level: level + 1 }
    }
}

interface BuildGrandTotalNodeOptions<TRow> {
    read?: CellRead<TRow>

    columns: ColumnDef<TRow>[]

    aggregations: Record<string, Aggregation<TRow>>

    labelColumnId?: string

    grandTotalLabel: (count: number) => string
}

export function buildGrandTotalNode<TRow>(
    leaves: RowNode<TRow>[],
    options: BuildGrandTotalNodeOptions<TRow>
): RowNode<TRow> {
    const values = aggregateRowValues(leaves, options.columns, options.aggregations, options.read)
    if (options.labelColumnId !== undefined) {
        values[options.labelColumnId] = options.grandTotalLabel(leaves.length)
    }

    return {
        id: GRAND_TOTAL_ID,
        row: markSyntheticRow(values as unknown as TRow),
        index: leaves.length > 0 ? leaves[0]!.index : 0,
        meta: { level: 0 }
    }
}
