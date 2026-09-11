import { type ColumnDef, type RowNode } from '../../core/types/index.js'
import { numericOrNull, withComputed } from '../../core/utils/index.js'
import { type CellRead, isDataRow, isLoadingRow, rawRead } from '../../core/grid/index.js'
import { totalsKindOf } from '../grouping/index.js'
import type { ShowAs } from './show-values-as.types.js'

interface ShareOptions<TRow> {
    shown: Record<string, ShowAs>
    columns: ColumnDef<TRow>[]
    read?: CellRead<TRow>
}

interface Column<TRow> {
    id: string
    showAs: ShowAs
    def: ColumnDef<TRow>
}

const levelOf = <TRow>(node: RowNode<TRow>): number => node.meta?.level ?? 0

function parentIndexes<TRow>(nodes: RowNode<TRow>[]): number[] {
    const parents: number[] = new Array(nodes.length).fill(-1)
    const openAt: number[] = []

    for (let index = 0; index < nodes.length; index++) {
        const level = levelOf(nodes[index]!)
        parents[index] = level > 0 ? (openAt[level - 1] ?? -1) : -1
        openAt[level] = index
        openAt.length = level + 1
    }
    return parents
}

function readColumn<TRow>(
    nodes: RowNode<TRow>[],
    column: ColumnDef<TRow>,
    read: CellRead<TRow>
): (number | null)[] {
    return nodes.map((node) => (isLoadingRow(node.row) ? null : numericOrNull(read(node, column))))
}

function grandTotalOf<TRow>(nodes: RowNode<TRow>[], values: (number | null)[]): number | null {
    let total: number | null = null
    for (let index = 0; index < nodes.length; index++) {
        const value = values[index] ?? null
        if (value === null || !isDataRow(nodes[index]!)) continue
        total = (total ?? 0) + value
    }
    return total
}

function rootTotal<TRow>(nodes: RowNode<TRow>[], values: (number | null)[]): number | null {
    let total: number | null = null
    for (let index = 0; index < nodes.length; index++) {
        const value = values[index] ?? null
        const node = nodes[index]!
        if (value === null || levelOf(node) !== 0 || totalsKindOf(node.id) !== null) continue
        total = (total ?? 0) + value
    }
    return total
}

function rowTotal<TRow>(
    node: RowNode<TRow>,
    of: string[],
    columns: ColumnDef<TRow>[],
    read: CellRead<TRow>
): number | null {
    let total: number | null = null
    for (const columnId of of) {
        const def = columns.find((column) => column.id === columnId)
        if (!def) continue
        const value = numericOrNull(read(node, def))
        if (value !== null) total = (total ?? 0) + value
    }
    return total
}

const share = (value: number | null, total: number | null): number | null =>
    value === null || total === null || total === 0 ? null : value / total

interface Pass<TRow> {
    parents: number[]
    read: CellRead<TRow>
    columns: ColumnDef<TRow>[]
}

function sharesFor<TRow>(
    nodes: RowNode<TRow>[],
    column: Column<TRow>,
    pass: Pass<TRow>
): (number | null)[] {
    const { parents, read, columns } = pass
    const values = readColumn(nodes, column.def, read)
    const { showAs } = column

    if (typeof showAs === 'object') {
        return nodes.map((node, index) =>
            share(values[index]!, rowTotal(node, showAs.of, columns, read))
        )
    }

    if (showAs === 'percentOfGrandTotal') {
        const grand = grandTotalOf(nodes, values)
        return values.map((value) => share(value, grand))
    }

    const roots = rootTotal(nodes, values)
    return values.map((value, index) => {
        const parent = parents[index]!
        return share(value, parent < 0 ? roots : values[parent]!)
    })
}

export function applyShares<TRow>(
    nodes: RowNode<TRow>[],
    options: ShareOptions<TRow>
): RowNode<TRow>[] {
    const read = options.read ?? rawRead
    const columns: Column<TRow>[] = []

    for (const [id, showAs] of Object.entries(options.shown)) {
        const def = options.columns.find((column) => column.id === id)
        if (def) columns.push({ id, showAs, def })
    }
    if (columns.length === 0) return nodes

    const parents = parentIndexes(nodes)
    const pass: Pass<TRow> = { parents, read, columns: options.columns }
    const shares = columns.map((column) => sharesFor(nodes, column, pass))

    return nodes.map((node, index) => {
        if (isLoadingRow(node.row)) return node

        const written: Record<string, unknown> = {}
        for (let entry = 0; entry < columns.length; entry++) {
            written[columns[entry]!.id] = shares[entry]![index]!
        }
        return { ...node, row: withComputed(node.row, written) }
    })
}
