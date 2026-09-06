import type { ColumnDef, RowNode, SortNulls, SortState } from '../../core/types/index.js'
import { isBlank, sortValueGetter, toDate } from '../../core/utils/index.js'

export type { SortNulls } from '../../core/types/index.js'

type IndexComparator = (a: number, b: number) => number

type KeyKind = 'number' | 'string' | 'mixed'

function keyKindOf(keys: unknown[]): KeyKind {
    let kind: 'number' | 'string' | null = null
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i]
        const type = typeof key
        if (type !== 'number' && type !== 'string') return 'mixed'
        if (key === '') return 'mixed'
        if (kind === null) kind = type
        else if (kind !== type) return 'mixed'
    }
    return kind ?? 'mixed'
}

function keyComparator(keys: unknown[], nullSign: number): IndexComparator {
    switch (keyKindOf(keys)) {
        case 'number':
            return (a, b) => (keys[a] as number) - (keys[b] as number)
        case 'string':
            return (a, b) => collator.compare(keys[a] as string, keys[b] as string)
        default:
            return (a, b) => compareValues(keys[a], keys[b], nullSign)
    }
}

export function sortNodes<TRow>(
    nodes: RowNode<TRow>[],
    columns: ColumnDef<TRow>[],
    sort: SortState[],
    nulls: SortNulls = 'first'
): RowNode<TRow>[] {
    if (sort.length === 0) return nodes

    const nullSign = nulls === 'last' ? 1 : -1
    const count = nodes.length
    const comparators = sort.flatMap<IndexComparator>((entry) => {
        const column = columns.find((c) => c.id === entry.columnId)
        if (!column) return []

        const factor = entry.direction === 'asc' ? 1 : -1
        if (column.sortFn) {
            const compare = column.sortFn
            return [(a: number, b: number) => compare(nodes[a].row, nodes[b].row) * factor]
        }

        const valueOf = sortValueGetter(column)
        const asDate = column.type === 'date' || column.type === 'datetime'
        const keys = new Array<unknown>(count)
        for (let i = 0; i < count; i++) {
            const value = valueOf(nodes[i].row)
            keys[i] = asDate && !isBlank(value) ? (toDate(value)?.getTime() ?? value) : value
        }

        const compare = keyComparator(keys, nullSign)
        return [(a: number, b: number) => compare(a, b) * factor]
    })
    if (comparators.length === 0) return nodes

    const order = new Array<number>(count)
    for (let i = 0; i < count; i++) order[i] = i

    order.sort((a, b) => {
        for (const compare of comparators) {
            const result = compare(a, b)
            if (result !== 0) return result
        }
        return 0
    })

    const sorted = new Array<RowNode<TRow>>(count)
    for (let i = 0; i < count; i++) sorted[i] = nodes[order[i]]
    return sorted
}

const collator = new Intl.Collator(undefined, { numeric: true })

function compareValues(a: unknown, b: unknown, nullSign: number): number {
    if (isBlank(a)) return isBlank(b) ? 0 : nullSign
    if (isBlank(b)) return -nullSign
    if (typeof a === 'number' && typeof b === 'number') return a - b
    if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b)
    if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime()
    return collator.compare(String(a), String(b))
}
