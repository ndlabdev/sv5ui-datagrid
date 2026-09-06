import { createDataGrid, type GridState } from '../../core/grid/index.js'
import { type ColumnDef } from '../../core/types/index.js'
import { filtering } from '../../features/filtering/index.js'
import { sorting } from '../../features/sorting/index.js'
import { describe, expect, it, vi } from 'vitest'
import { editing, getEditing } from '../../features/editing/index.js'
import { advancedFilter, getAdvancedFilter } from '../advanced-filter/index.js'
import { conditionalFormatting, getConditionalFormatting } from '../conditional-formatting/index.js'
import { findReplace, getFindReplace } from '../find-replace/index.js'
import { formula } from '../formula/index.js'
import { getGrouping, grouping } from '../grouping/index.js'
import { getRangeSelection, rangeSelection } from '../range-selection/index.js'
import { showValuesAs } from '../show-values-as/index.js'
import { buildGridXlsx } from '../xlsx/index.js'
import { readXlsx } from '../data-import/index.js'
import { policy } from './policy.svelte.js'

interface Person {
    id: number
    name: string
    salary: number
    dept: string
    doubled?: number
}

const people: Person[] = [
    { id: 1, name: 'Chi', salary: 120_000, dept: 'Core' },
    { id: 2, name: 'An', salary: 60_000, dept: 'Data' },
    { id: 3, name: 'Binh', salary: 90_000, dept: 'Core' }
]

const columns: ColumnDef<Person>[] = [
    { id: 'name', header: 'Name' },
    { id: 'salary', header: 'Salary', type: 'currency' },
    { id: 'dept', header: 'Dept' },
    { id: 'doubled', header: 'Doubled', type: 'currency' }
]

const guard = () => policy<Person>({ rules: [{ columns: ['salary'], mask: 'hide' }] })

function makeGrid(extra: unknown[] = []): GridState<Person> {
    return createDataGrid<Person>({
        columns,
        data: people,
        getRowId: (row) => String(row.id),
        features: [guard(), ...(extra as never[])]
    })
}

describe('a masked value must not come back out through', () => {
    it('the clipboard', () => {
        const grid = makeGrid([sorting(), rangeSelection()])
        const range = getRangeSelection(grid)!
        range.selectAll()

        const text = range.getRangeTsv()
        expect(text).not.toContain('120000')
        expect(text).not.toContain('120,000')
    })

    it('the matrix a copy is built from', () => {
        const grid = makeGrid([sorting(), rangeSelection()])
        const range = getRangeSelection(grid)!
        range.selectAll()

        expect(range.getRangeMatrix().flat()).not.toContain('120000')
    })

    it('an XLSX export', async () => {
        const grid = makeGrid([sorting()])
        const workbook = await buildGridXlsx(grid, {})
        const { rows } = await readXlsx(workbook)

        const flat = rows.flat().map((cell) => String(cell))
        expect(flat).not.toContain('120000')
    })

    it('find and replace', () => {
        const grid = makeGrid([findReplace<Person>()])
        const find = getFindReplace(grid)!
        find.query = '120000'

        expect(find.matches).toHaveLength(0)
    })

    it("Pro's own advanced filter", () => {
        const grid = makeGrid([filtering(), advancedFilter<Person>()])
        getAdvancedFilter(grid)!.setModel({
            kind: 'group',
            join: 'and',
            children: [{ kind: 'condition', columnId: 'salary', op: 'gt', value: 100_000 }]
        })

        expect(grid.preWindowNodes).toHaveLength(0)
    })

    it('a group aggregate', () => {
        const grid = makeGrid([grouping<Person>({ by: ['dept'], aggregations: { salary: 'sum' } })])
        void getGrouping(grid)

        const totals = grid.preWindowNodes
            .map((node) => (node.row as Person).salary)
            .filter((value) => typeof value === 'number')
        expect(totals).not.toContain(210_000)
    })

    it('a formula column built over it', () => {
        const grid = makeGrid([formula<Person>({ columns: { doubled: 'salary * 2' } })])

        const doubled = grid.preWindowNodes.map((node) => node.row.doubled)
        expect(doubled).not.toContain(240_000)
    })

    it('a share of the total, which would divide one real number by another', () => {
        const grid = makeGrid([
            grouping<Person>({ by: ['dept'], aggregations: { salary: 'sum' } }),
            showValuesAs<Person>({ columns: { salary: 'percentOfGrandTotal' } })
        ])

        const shares = grid.preWindowNodes.map((node) => (node.row as Person).salary)
        expect(shares.filter((value) => typeof value === 'number')).toEqual([])
    })
})

describe('the values a panel offers', () => {
    it('does not list the real ones in a set filter', () => {
        const grid = makeGrid([filtering()])
        const salary = grid.columns.get('salary')!
        const offered = grid.preWindowNodes.map((node) => grid.getValue(node, salary, 'facet'))

        expect(offered).not.toContain(120_000)
    })

    it('does not paint a colour scale by the real ranking', () => {
        const grid = makeGrid([
            conditionalFormatting<Person>({ rules: [{ kind: 'colorScale', column: 'salary' }] })
        ])
        const format = getConditionalFormatting(grid)!
        const salary = grid.columns.get('salary')!

        const painted = grid.preWindowNodes.map(
            (node) => format.decoration(node, salary)?.style?.['background-color']
        )
        expect(new Set(painted).size).toBe(1)
    })
})

describe('a masked cell is not a way in either', () => {
    it('cannot be edited, because the grid refuses a substituted cell', () => {
        const grid = createDataGrid<Person>({
            columns: [
                { id: 'name', header: 'Name', editable: true },
                { id: 'salary', header: 'Salary', editable: true }
            ],
            data: people,
            getRowId: (row) => String(row.id),
            features: [editing(), guard()]
        })

        const salary = grid.columns.get('salary')!
        const name = grid.columns.get('name')!
        const node = grid.preWindowNodes[0]!
        const editor = getEditing(grid)!

        expect(editor.editableAt(node, name.def)).toBe(true)
        expect(editor.editableAt(node, salary.def)).toBe(false)
    })

    it('leaves an unguarded column untouched, by identity', () => {
        const grid = makeGrid()
        const node = grid.preWindowNodes[0]!
        const name = grid.columns.get('name')!

        expect(grid.getValue(node, name, 'render')).toBe('Chi')
    })
})

describe('what the policy says out loud', () => {
    it('warns when a masked column is left sortable or filterable', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

        const grid = createDataGrid<Person>({
            columns: [
                { id: 'name', header: 'Name' },
                { id: 'salary', header: 'Salary', sortable: true, filter: 'number' }
            ],
            data: people,
            getRowId: (row) => String(row.id),
            features: [sorting(), guard()]
        })
        void grid.getValue(grid.preWindowNodes[0]!, grid.columns.visible[0]!, 'render')

        expect(warn).toHaveBeenCalled()
        expect(String(warn.mock.calls[0]?.[0])).toContain('salary')
        warn.mockRestore()
    })
})
