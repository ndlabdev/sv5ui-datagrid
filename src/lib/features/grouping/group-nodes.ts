import { type ColumnDef, type RowNode } from '../../core/types/index.js'
import { type CellRead, markSyntheticRow, rawRead } from '../../core/grid/index.js'
import { aggregateRowValues, buildFooterNode, groupPathId } from './totals-nodes.js'
import type { Aggregation } from './grouping.types.js'
import { isBlank, withComputed } from '../../core/utils/index.js'

interface BuildGroupNodesOptions<TRow> {
    read?: CellRead<TRow>

    by: string[]

    columns: ColumnDef<TRow>[]

    aggregations: Record<string, Aggregation<TRow>>

    isExpanded: (groupId: string) => boolean

    groupLabel: (key: string, count: number, columnId: string) => string

    footerLabel?: (key: string, count: number, columnId: string) => string

    repeat?: RepeatRows<TRow>

    opensToRows?: boolean
}

interface RepeatRows<TRow> {
    count: number

    aggregationsAt: (at: number) => Record<string, Aggregation<TRow>>

    idAt: (groupId: string, at: number) => string

    fieldsAt: (at: number) => Record<string, unknown>
}

function repeatedRows<TRow>(
    members: RowNode<TRow>[],
    groupId: string,
    level: number,
    options: BuildGroupNodesOptions<TRow>
): RowNode<TRow>[] {
    const repeat = options.repeat!
    const out: RowNode<TRow>[] = []

    for (let at = 0; at < repeat.count; at++) {
        const row = markSyntheticRow(
            withComputed({} as TRow, {
                ...aggregateRowValues(
                    members,
                    options.columns,
                    repeat.aggregationsAt(at),
                    options.read
                ),
                ...repeat.fieldsAt(at)
            })
        )

        out.push({
            id: repeat.idAt(groupId, at),
            row,
            index: members[0]!.index,
            meta: { level, setSize: repeat.count, posInSet: at + 1 }
        })
    }

    return out
}

export function groupNodeId(path: { columnId: string; key: string }[]): string {
    return groupPathId('group', path)
}

function columnById<TRow>(columns: ColumnDef<TRow>[], id: string): ColumnDef<TRow> | undefined {
    return columns.find((column) => column.id === id)
}

function keyOf<TRow>(node: RowNode<TRow>, column: ColumnDef<TRow>, read: CellRead<TRow>): string {
    const value = read(node, column)
    return isBlank(value) ? '(blank)' : String(value)
}

function partition<TRow>(
    nodes: RowNode<TRow>[],
    column: ColumnDef<TRow>,
    read: CellRead<TRow> = rawRead
): Map<string, RowNode<TRow>[]> {
    const groups = new Map<string, RowNode<TRow>[]>()
    for (const node of nodes) {
        const key = keyOf(node, column, read)
        const bucket = groups.get(key)
        if (bucket) bucket.push(node)
        else groups.set(key, [node])
    }
    return groups
}

function gatheredRow<TRow>(
    members: RowNode<TRow>[],
    at: { columnId: string; key: string },
    options: BuildGroupNodesOptions<TRow>
): TRow {
    const measured = options.repeat
        ? {}
        : aggregateRowValues(members, options.columns, options.aggregations, options.read)

    return markSyntheticRow(
        withComputed({} as TRow, {
            ...measured,
            [at.columnId]: options.groupLabel(at.key, members.length, at.columnId)
        })
    )
}

function buildLevel<TRow>(
    nodes: RowNode<TRow>[],
    level: number,
    path: { columnId: string; key: string }[],
    options: BuildGroupNodesOptions<TRow>
): RowNode<TRow>[] {
    const columnId = options.by[level]
    const column = columnId ? columnById(options.columns, columnId) : undefined

    if (!columnId || !column) {
        return nodes.map((node) => ({ ...node, meta: { ...node.meta, level } }))
    }

    const groups = partition(nodes, column, options.read)
    const setSize = groups.size
    const output: RowNode<TRow>[] = []
    let position = 0

    for (const [key, members] of groups) {
        position += 1
        const groupPath = [...path, { columnId, key }]
        const id = groupNodeId(groupPath)
        const row = gatheredRow(members, { columnId, key }, options)
        const opens = level < options.by.length - 1 || options.opensToRows !== false

        output.push({
            id,
            row,
            index: members[0]!.index,
            meta: { level, expandable: opens, setSize, posInSet: position }
        })

        if (options.repeat) output.push(...repeatedRows(members, id, level + 1, options))

        if (opens && options.isExpanded(id)) {
            output.push(...buildLevel(members, level + 1, groupPath, options))
            if (options.footerLabel) {
                output.push(
                    buildFooterNode(groupPath, members, level, {
                        columns: options.columns,
                        aggregations: options.aggregations,
                        footerLabel: options.footerLabel
                    })
                )
            }
        }
    }

    return output
}

export function buildGroupNodes<TRow>(
    nodes: RowNode<TRow>[],
    options: BuildGroupNodesOptions<TRow>
): RowNode<TRow>[] {
    if (options.by.length === 0) return nodes
    return buildLevel(nodes, 0, [], options)
}
