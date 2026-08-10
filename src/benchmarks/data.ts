import { buildRowNodes } from '../lib/core/grid/row-node.js'
import type { ColumnDef, RowNode } from '../lib/core/types/index.js'

export interface BenchRow {
    id: number
    name: string
    email: string
    score: number
    active: boolean
}

export const benchColumns: ColumnDef<BenchRow>[] = [
    { id: 'name', sortable: true, filter: 'text' },
    { id: 'email', filter: 'text' },
    { id: 'score', sortable: true, filter: 'number' },
    { id: 'active', filter: 'boolean' }
]

export function makeBenchRows(count: number): BenchRow[] {
    return Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        name: `Person ${((i * 7919) % count) + 1}`,
        email: `user${i + 1}@example.com`,
        score: (i * 37) % 1000,
        active: i % 3 === 0
    }))
}

export function makeBenchNodes(count: number): RowNode<BenchRow>[] {
    return buildRowNodes(makeBenchRows(count), (row) => String(row.id))
}

/** One row of a backend generated on demand: its size costs nothing unasked. */
export function serverRowAt(index: number): BenchRow {
    return {
        id: index + 1,
        name: `Person ${(index * 7919) % 1_000_003}`,
        email: `user${index + 1}@example.com`,
        score: (index * 37) % 1000,
        active: index % 3 === 0
    }
}

export function serverPageOf(page: number, pageSize: number): BenchRow[] {
    const rows: BenchRow[] = []
    const start = (page - 1) * pageSize
    for (let offset = 0; offset < pageSize; offset++) rows.push(serverRowAt(start + offset))
    return rows
}
