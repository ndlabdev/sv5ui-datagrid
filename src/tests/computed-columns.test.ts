import { describe, expect, it } from 'vitest'
import {
    createDataGrid,
    formula,
    grouping,
    showValuesAs,
    type ColumnDef,
    type GridState
} from '$lib/index.js'

interface P {
    id: number
    team: string
    salary: number
}

const salaryOf = (person: P) => person.salary

const people: P[] = [
    { id: 1, team: 'A', salary: 100 },
    { id: 2, team: 'A', salary: 200 },
    { id: 3, team: 'A', salary: 300 }
]

function valueOf(grid: GridState<P>, node: number, columnId: string): unknown {
    const column = grid.columns.all.find((candidate) => candidate.id === columnId)!
    return grid.getValue(grid.preWindowNodes[node]!, column)
}

describe('a column that reads its field through an accessor', () => {
    it('shows its own aggregate on a group row, not the one beside it', () => {
        const columns: ColumnDef<P>[] = [
            { id: 'team' },
            { id: 'salary' },
            { id: 'salaryMedian', accessor: salaryOf },
            { id: 'salaryP90', accessor: salaryOf }
        ]
        const grid = createDataGrid<P>({
            columns,
            data: people,
            getRowId: (person) => String(person.id),
            features: [
                grouping({
                    by: ['team'],
                    aggregations: {
                        salary: 'sum',
                        salaryMedian: 'median',
                        salaryP90: { kind: 'percentile', p: 0.9 }
                    }
                })
            ]
        })

        expect(valueOf(grid, 0, 'salary')).toBe(600)
        expect(valueOf(grid, 0, 'salaryMedian')).toBe(200)
        expect(valueOf(grid, 0, 'salaryP90')).toBe(280)
    })

    it('shows the share written for it rather than the number underneath', () => {
        const grid = createDataGrid<P>({
            columns: [{ id: 'team' }, { id: 'salary' }, { id: 'share', accessor: salaryOf }],
            data: people,
            getRowId: (person) => String(person.id),
            features: [showValuesAs({ columns: { share: 'percentOfGrandTotal' } })]
        })

        expect(valueOf(grid, 0, 'share')).toBeCloseTo(100 / 600)
        expect(valueOf(grid, 0, 'salary')).toBe(100)
    })

    it('shows what a formula computed for it', () => {
        const grid = createDataGrid<P>({
            columns: [{ id: 'team' }, { id: 'salary' }, { id: 'doubled', accessor: salaryOf }],
            data: people,
            getRowId: (person) => String(person.id),
            features: [formula({ columns: { doubled: 'salary * 2' } })]
        })

        expect(valueOf(grid, 0, 'doubled')).toBe(200)
    })

    it('still runs the accessor on a row nothing computed for', () => {
        const grid = createDataGrid<P>({
            columns: [{ id: 'team' }, { id: 'doubled', accessor: (row) => row.salary * 2 }],
            data: people,
            getRowId: (person) => String(person.id)
        })

        expect(valueOf(grid, 0, 'doubled')).toBe(200)
    })
})
