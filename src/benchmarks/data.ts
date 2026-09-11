import { buildRowNodes } from '../lib/core/grid/index.js'
import type { ColumnDef, RowNode } from '../lib/core/types/index.js'

export interface BenchRow {
    id: number
    name: string
    email: string
    score: number
    active: boolean
    dept: string
    country: string
    salary: number
}

const DEPTS = ['Core', 'Platform', 'Growth', 'Data', 'Infra', 'Design']
const COUNTRIES = ['VN', 'US', 'DE', 'JP', 'SG', 'AU']

export const benchColumns: ColumnDef<BenchRow>[] = [
    { id: 'name', sortable: true, filter: 'text' },
    { id: 'email', filter: 'text' },
    { id: 'score', sortable: true, filter: 'number' },
    { id: 'active', filter: 'boolean' }
]

export const wideBenchColumns: ColumnDef<BenchRow>[] = [
    { id: 'name', sortable: true, filter: 'text' },
    { id: 'dept', filter: 'text' },
    { id: 'country', filter: 'text' },
    { id: 'salary', sortable: true, filter: 'number' },
    { id: 'active', filter: 'boolean' }
]

export const benchRowId = (row: BenchRow): string => String(row.id)

export function makeBenchRows(count: number): BenchRow[] {
    return Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        name: `Person ${((i * 7919) % count) + 1}`,
        email: `user${i + 1}@example.com`,
        score: (i * 37) % 1000,
        active: i % 3 === 0,
        dept: DEPTS[i % DEPTS.length]!,
        country: COUNTRIES[Math.floor(i / DEPTS.length) % COUNTRIES.length]!,
        salary: 40_000 + ((i * 37) % 90_000)
    }))
}

export function makeBenchNodes(count: number): RowNode<BenchRow>[] {
    return buildRowNodes(makeBenchRows(count), (row) => String(row.id))
}

function serverRowAt(index: number): BenchRow {
    return {
        id: index + 1,
        name: `Person ${(index * 7919) % 1_000_003}`,
        email: `user${index + 1}@example.com`,
        score: (index * 37) % 1000,
        active: index % 3 === 0,
        dept: DEPTS[index % DEPTS.length]!,
        country: COUNTRIES[Math.floor(index / DEPTS.length) % COUNTRIES.length]!,
        salary: 40_000 + ((index * 37) % 90_000)
    }
}

export function serverPageOf(page: number, pageSize: number): BenchRow[] {
    const rows: BenchRow[] = []
    const start = (page - 1) * pageSize
    for (let offset = 0; offset < pageSize; offset++) rows.push(serverRowAt(start + offset))
    return rows
}
