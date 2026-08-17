import type { ColumnDef, RowNode, SortState } from '../../core/types/index.js'
import { isBlank, sortValueGetter } from '../../core/utils/index.js'

/**
 * Where the holes land. Blank is null, undefined or the empty string — the same
 * set the `blank` filter operator matches and the renderers show as empty.
 */
export type SortNulls = 'first' | 'last'

/** Compares two rows by their position, so the keys can be read by index. */
type IndexComparator = (a: number, b: number) => number

/**
 * What a column's values turned out to be, from one pass over the keys.
 *
 * `compareValues` asks four questions of every pair it is given, and for a
 * column that is all numbers or all text the answer is the same every time.
 * Asking once per column instead of once per comparison is worth a scan.
 */
type KeyKind = 'number' | 'string' | 'mixed'

function keyKindOf(keys: unknown[]): KeyKind {
    let kind: 'number' | 'string' | null = null
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i]
        const type = typeof key
        // Blanks, dates and booleans all take the general path: they are the
        // cases `compareValues` exists for.
        if (type !== 'number' && type !== 'string') return 'mixed'
        if (key === '') return 'mixed'
        if (kind === null) kind = type
        else if (kind !== type) return 'mixed'
    }
    return kind ?? 'mixed'
}

/**
 * The comparator specialized to what the column holds. Each branch returns
 * exactly what `compareValues` would for those values — a column of numbers
 * without blanks can only reach its subtraction, and one of non-empty strings
 * only its collator — so the ordering is the same and only the questions go.
 */
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
        // A comparator of the app's own compares whole rows, so there is no
        // key to read ahead: it stays on the rows themselves.
        if (column.sortFn) {
            const compare = column.sortFn
            return [(a: number, b: number) => compare(nodes[a].row, nodes[b].row) * factor]
        }

        // Read once per row rather than twice per comparison. Sorting 100k
        // rows makes on the order of 1.7M comparisons, and what sits behind a
        // column is the app's `accessor`, called every one of those times.
        const valueOf = sortValueGetter(column)
        const keys = new Array<unknown>(count)
        for (let i = 0; i < count; i++) keys[i] = valueOf(nodes[i].row)

        const compare = keyComparator(keys, nullSign)
        return [(a: number, b: number) => compare(a, b) * factor]
    })
    if (comparators.length === 0) return nodes

    // Positions are sorted rather than nodes, so a comparison is two array
    // reads. `Array.prototype.sort` is stable, and the positions start in
    // order, so rows the sort cannot separate keep the order they arrived in.
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
