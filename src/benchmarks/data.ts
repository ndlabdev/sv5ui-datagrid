import { buildRowNodes } from '../lib/core/row-node.js'
import type { ColumnDef, RowNode } from '../lib/core/types.js'

export interface BenchRow {
    id: number
    name: string
    email: string
    score: number
    active: boolean
}

export const benchColumns: ColumnDef<BenchRow>[] = [
    { id: 'name', sortable: true },
    { id: 'email' },
    { id: 'score', sortable: true },
    { id: 'active' }
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
