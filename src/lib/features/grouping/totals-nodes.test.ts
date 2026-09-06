import { createDataGrid, isSyntheticRow } from '../../core/grid/index.js'
import { type ColumnDef, type RowNode } from '../../core/types/index.js'
import { filtering } from '../../features/filtering/index.js'
import { describe, expect, it } from 'vitest'
import { buildGroupNodes } from './group-nodes.js'
import { grouping } from './grouping.svelte.js'
import {
    aggregateRowValues,
    buildFooterNode,
    buildGrandTotalNode,
    footerNodeId,
    GRAND_TOTAL_ID,
    totalsKindOf
} from './totals-nodes.js'
import type { Aggregation } from './grouping.types.js'

function buildRowNodes<TRow>(data: TRow[], getRowId: (row: TRow) => string): RowNode<TRow>[] {
    return data.map((row, index) => ({ id: getRowId(row), row, index }))
}

interface Person {
    id: number
    name: string
    dept: string
    country: string
    salary: number
}

const people: Person[] = [
    { id: 1, name: 'Alice', dept: 'Core', country: 'VN', salary: 100 },
    { id: 2, name: 'Bob', dept: 'Core', country: 'VN', salary: 200 },
    { id: 3, name: 'Carol', dept: 'Core', country: 'US', salary: 300 },
    { id: 4, name: 'Dave', dept: 'Data', country: 'US', salary: 400 }
]

const columns: ColumnDef<Person>[] = [
    { id: 'name' },
    { id: 'dept' },
    { id: 'country' },
    { id: 'salary' }
]

const nodes = buildRowNodes(people, (person) => String(person.id))

const salarySum: Record<string, Aggregation<Person>> = { salary: 'sum' }

describe('totalsKindOf', () => {
    it('classifies footer, grand-total and ordinary ids', () => {
        expect(totalsKindOf(footerNodeId([{ columnId: 'dept', key: 'Core' }]))).toBe('footer')
        expect(totalsKindOf(GRAND_TOTAL_ID)).toBe('grandTotal')
        expect(totalsKindOf('group:dept=Core')).toBeNull()
        expect(totalsKindOf('42')).toBeNull()
    })
})

describe('aggregateRowValues', () => {
    it('runs every aggregation keyed by column id', () => {
        const values = aggregateRowValues(nodes, columns, {
            salary: 'sum',
            name: 'count'
        })
        expect(values).toEqual({ salary: 1000, name: 4 })
    })

    it('hands values and rows to a custom reducer', () => {
        const values = aggregateRowValues(nodes, columns, {
            salary: (cells, rows) => `${cells.length}/${rows.length}`
        })
        expect(values.salary).toBe('4/4')
    })

    it('aggregates over an empty cell list for an unknown column', () => {
        const values = aggregateRowValues(nodes, columns, { missing: 'sum' })
        expect(values.missing).toBeNull()
    })
})

describe('buildFooterNode', () => {
    it('carries the aggregates and the footer label one level below the group', () => {
        const path = [{ columnId: 'dept', key: 'Core' }]
        const members = nodes.slice(0, 3)
        const footer = buildFooterNode(path, members, 0, {
            columns,
            aggregations: salarySum,
            footerLabel: (key, count) => `Total ${key} (${count})`
        })

        expect(footer.id).toBe('footer:dept=Core')
        expect(footer.meta).toEqual({ level: 1 })
        expect(footer.row).toMatchObject({ salary: 600, dept: 'Total Core (3)' })
        expect(isSyntheticRow(footer.row)).toBe(true)
    })
})

describe('buildGroupNodes with footers', () => {
    function build(by: string[], expanded: (id: string) => boolean = () => true) {
        return buildGroupNodes(nodes, {
            by,
            columns,
            aggregations: salarySum,
            isExpanded: expanded,
            groupLabel: (key, count) => `${key} (${count})`,
            footerLabel: (key) => `Total - ${key}`
        })
    }

    it('closes each expanded group with its footer', () => {
        expect(build(['dept']).map((node) => node.id)).toEqual([
            'group:dept=Core',
            '1',
            '2',
            '3',
            'footer:dept=Core',
            'group:dept=Data',
            '4',
            'footer:dept=Data'
        ])
    })

    it('omits the footer of a collapsed group', () => {
        const result = build(['dept'], (id) => id !== 'group:dept=Core')
        expect(result.map((node) => node.id)).toEqual([
            'group:dept=Core',
            'group:dept=Data',
            '4',
            'footer:dept=Data'
        ])
    })

    it('nests footers per level, inner before outer', () => {
        const ids = build(['dept', 'country']).map((node) => node.id)
        expect(ids).toEqual([
            'group:dept=Core',
            'group:dept=Core|country=VN',
            '1',
            '2',
            'footer:dept=Core|country=VN',
            'group:dept=Core|country=US',
            '3',
            'footer:dept=Core|country=US',
            'footer:dept=Core',
            'group:dept=Data',
            'group:dept=Data|country=US',
            '4',
            'footer:dept=Data|country=US',
            'footer:dept=Data'
        ])
    })
})

describe('buildGrandTotalNode', () => {
    it('aggregates every leaf and writes the label into the label column', () => {
        const total = buildGrandTotalNode(nodes, {
            columns,
            aggregations: salarySum,
            labelColumnId: 'name',
            grandTotalLabel: (count) => `Total (${count})`
        })

        expect(total.id).toBe(GRAND_TOTAL_ID)
        expect(total.row).toMatchObject({ salary: 1000, name: 'Total (4)' })
    })

    it('shows aggregates only when no label column is free', () => {
        const total = buildGrandTotalNode(nodes, {
            columns,
            aggregations: salarySum,
            grandTotalLabel: (count) => `Total (${count})`
        })
        expect(total.row).toMatchObject({ salary: 1000 })
    })
})

describe('grouping feature with totals', () => {
    function createGrid(options: Parameters<typeof grouping<Person>>[0] = {}) {
        return createDataGrid<Person>({
            columns,
            data: people,
            getRowId: (person) => String(person.id),
            features: [filtering(), grouping<Person>(options)]
        })
    }

    it('appends the grand-total row after the leaf rows when not grouped', () => {
        const grid = createGrid({ grandTotal: true, aggregations: salarySum })
        const last = grid.nodes[grid.nodes.length - 1]

        expect(last!.id).toBe(GRAND_TOTAL_ID)
        expect((last!.row as unknown as Record<string, unknown>).salary).toBe(1000)

        expect((last!.row as unknown as Record<string, unknown>).name).toBe('Total (4)')
    })

    it('labels the grand total in the first grouped column when grouped', () => {
        const grid = createGrid({ by: ['dept'], grandTotal: true, aggregations: salarySum })
        const last = grid.nodes[grid.nodes.length - 1]

        expect(last!.id).toBe(GRAND_TOTAL_ID)
        expect((last!.row as unknown as Record<string, unknown>).dept).toBe('Total (4)')
    })

    it('reflects the active filter in footers and the grand total', () => {
        const grid = createGrid({
            by: ['dept'],
            groupFooters: true,
            grandTotal: true,
            aggregations: salarySum
        })
        ;(grid.api.setQuickFilter as (query: string) => void)('Core')

        const withFilter = () => {
            const ids = grid.nodes.map((node) => node.id)
            const total = grid.nodes[grid.nodes.length - 1]!.row as unknown as Record<
                string,
                unknown
            >
            return { ids, total }
        }

        const { ids, total } = withFilter()
        expect(ids).toContain('footer:dept=Core')
        expect(ids).not.toContain('group:dept=Data')
        expect(total.salary).toBe(600)
    })

    it('emits no grand total for an empty grid', () => {
        const grid = createDataGrid<Person>({
            columns,
            data: [],
            getRowId: (person) => String(person.id),
            features: [grouping<Person>({ grandTotal: true, aggregations: salarySum })]
        })
        expect(grid.nodes).toHaveLength(0)
    })
})
