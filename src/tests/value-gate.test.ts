import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
    createDataGrid,
    editing,
    filtering,
    getEditing,
    getFiltering,
    getPagination,
    getSelection,
    pagination,
    rowsToMatrix,
    selection,
    type CellValuePurpose,
    type ColumnDef,
    type GridFeature,
    type GridState
} from '$lib/index.js'

interface Person {
    id: number
    name: string
    salary: number
}

const MASK = '***'

const columns: ColumnDef<Person>[] = [
    { id: 'name', header: 'Name', editable: true },
    { id: 'salary', header: 'Salary', filter: 'set', editable: true }
]

const people: Person[] = [
    { id: 1, name: 'Ada', salary: 9000 },
    { id: 2, name: 'Grace', salary: 8000 }
]

function mask(purposes?: CellValuePurpose[]): GridFeature<Person> {
    return {
        id: 'mask',
        cellValue: ({ column, purpose }) =>
            column.id === 'salary' && (purposes === undefined || purposes.includes(purpose))
                ? () => MASK
                : undefined
    }
}

function makeGrid(
    features: GridFeature<Person>[] = [],
    data = people,
    mode: 'cell' | 'row' = 'cell'
): GridState<Person> {
    return createDataGrid<Person>({
        columns,
        data: data.map((row) => ({ ...row })),
        getRowId: (row) => String(row.id),
        features: [filtering(), selection(), editing({ mode }), ...features]
    })
}

const firstNode = (grid: GridState<Person>) => grid.nodes[0]!
const salaryColumn = (grid: GridState<Person>) => grid.columns.get('salary')!

describe('a gate closes every way a value leaves the grid', () => {
    it('substitutes what a cell draws, and leaves the other columns alone', () => {
        const grid = makeGrid([mask()])
        const node = firstNode(grid)

        expect(grid.getValue(node, salaryColumn(grid))).toBe(MASK)
        expect(grid.getValue(node, grid.columns.get('name')!)).toBe('Ada')
    })

    it('substitutes what the clipboard carries', () => {
        const grid = makeGrid([mask()])
        getSelection(grid)!.selectAll()

        const text = getSelection(grid)!.copyText()!
        expect(text).toContain(MASK)
        expect(text).not.toContain('9000')
    })

    it('substitutes what an export writes, formatter and all', () => {
        const grid = makeGrid([mask()])
        const matrix = rowsToMatrix(grid.nodes, grid.columns.visible, undefined, {
            read: (column) => grid.readerFor(column.id, 'export')
        })
        expect(matrix[0]).toEqual(['Ada', MASK])

        const formatted = rowsToMatrix(
            grid.nodes,
            grid.columns.visible,
            ({ value }) => `<${String(value)}>`,
            { read: (column) => grid.readerFor(column.id, 'export') }
        )
        expect(formatted[0]).toEqual(['<Ada>', `<${MASK}>`])
    })

    it('substitutes the text a quick filter searches', () => {
        const grid = makeGrid([mask()])
        const state = getFiltering(grid)!

        state.setQuickFilter('9000')
        expect(grid.nodes).toHaveLength(0)

        state.setQuickFilter(MASK)
        expect(grid.nodes).toHaveLength(2)
    })

    it('substitutes the values a set filter offers', () => {
        const grid = makeGrid([mask()])
        expect(getFiltering(grid)!.distinctFor('salary')).toEqual([MASK])
        expect(getFiltering(grid)!.distinctFor('name')).toEqual(['Ada', 'Grace'])
    })

    it('refuses to edit a cell it substituted, and still edits one it did not', () => {
        const grid = makeGrid([mask()])
        const state = getEditing(grid)!
        const node = firstNode(grid)

        expect(state.editableAt(node, salaryColumn(grid).def)).toBe(false)
        state.startEdit(node.id, 'salary')
        expect(state.active).toBeNull()

        state.startEdit(node.id, 'name')
        expect(state.active).toEqual({ rowId: node.id, columnId: 'name' })
    })

    it('drops a substituted cell out of a batch, which is how a paste lands', () => {
        const grid = makeGrid([mask()])
        const node = firstNode(grid)

        const written = getEditing(grid)!.applyEdits([
            { rowId: node.id, changes: { salary: 1, name: 'Ada Lovelace' } }
        ])

        expect(written).toBe(true)
        expect(firstNode(grid).row).toEqual({ id: 1, name: 'Ada Lovelace', salary: 9000 })
    })

    it('keeps a gated column out of a row edit, and out of what the row writes', () => {
        const grid = makeGrid([mask()], people, 'row')
        const state = getEditing(grid)!
        state.startRowEdit(firstNode(grid).id)

        expect(Object.keys(state.drafts)).toEqual(['name'])

        state.setRowDraft('salary', 1)
        state.setRowDraft('name', 'Ada Lovelace')
        expect(state.commitRow()).toBe(true)
        expect(firstNode(grid).row).toEqual({ id: 1, name: 'Ada Lovelace', salary: 9000 })
    })

    it('substitutes a formatted copy as well as a plain one', () => {
        const grid = makeGrid([mask()])
        getSelection(grid)!.selectAll()

        const text = getSelection(grid)!.copyText({ formatted: true, headers: true })!
        expect(text).toContain(MASK)
        expect(text).not.toContain('9000')
    })

    it('reads per cell, so a gate may hide one row of a column and not the next', () => {
        const perRow: GridFeature<Person> = {
            id: 'per-row',
            cellValue: ({ column }) =>
                column.id === 'salary'
                    ? (value, node) => (node.id === '1' ? MASK : value)
                    : undefined
        }
        const grid = makeGrid([perRow])
        const state = getEditing(grid)!
        const [ada, grace] = grid.nodes

        expect(grid.getValue(ada!, salaryColumn(grid))).toBe(MASK)
        expect(grid.getValue(grace!, salaryColumn(grid))).toBe(8000)
        expect(state.editableAt(ada!, salaryColumn(grid).def)).toBe(false)
        expect(state.editableAt(grace!, salaryColumn(grid).def)).toBe(true)
    })

    it('leaves editing alone when the reader hands the value back unchanged', () => {
        const passthrough: GridFeature<Person> = {
            id: 'passthrough',
            cellValue: () => (value) => value
        }
        const grid = makeGrid([passthrough])
        const node = firstNode(grid)

        expect(getEditing(grid)!.editableAt(node, salaryColumn(grid).def)).toBe(true)
    })
})

describe('a gate is scoped to the purposes it asks for', () => {
    it('closes the clipboard without touching what the cell draws', () => {
        const grid = makeGrid([mask(['clipboard'])])
        getSelection(grid)!.selectAll()

        expect(grid.getValue(firstNode(grid), salaryColumn(grid))).toBe(9000)
        expect(getSelection(grid)!.copyText()!).toContain(MASK)
    })

    it('has no reader for a column it does not gate', () => {
        const grid = makeGrid([mask()])
        expect(grid.readerFor('name', 'render')).toBeUndefined()
        expect(grid.readerFor('salary', 'render')).toBeDefined()
    })

    it('has no reader at all when no feature gates anything', () => {
        const grid = makeGrid()
        for (const purpose of [
            'render',
            'export',
            'clipboard',
            'search',
            'facet',
            'edit'
        ] as const) {
            expect(grid.readerFor('salary', purpose)).toBeUndefined()
        }
    })
})

describe('a gate is asked per column on the passes that read whole columns', () => {
    const crowd = (size: number) =>
        Array.from({ length: size }, (_, i) => ({ id: i, name: `Person ${i}`, salary: i }))

    function counter(): { feature: GridFeature<Person>; asked: () => number } {
        let asked = 0
        return {
            asked: () => asked,
            feature: {
                id: 'counting',
                cellValue: ({ column }) => {
                    asked++
                    return column.id === 'salary' ? () => MASK : undefined
                }
            }
        }
    }

    function copyCost(size: number): number {
        const { feature, asked } = counter()
        const grid = makeGrid([feature], crowd(size))
        getSelection(grid)!.selectAll()
        const before = asked()

        expect(getSelection(grid)!.copyText()).toContain(MASK)
        return asked() - before
    }

    function searchCost(size: number): number {
        const { feature, asked } = counter()
        const grid = makeGrid([feature], crowd(size))
        void grid.nodes
        const before = asked()

        getFiltering(grid)!.setQuickFilter('person 1')
        expect(grid.nodes.length).toBeGreaterThan(0)
        return asked() - before
    }

    it('costs the same to copy 500 rows as to copy 50', () => {
        expect(copyCost(500)).toBe(copyCost(50))
    })

    it('costs the same to search 500 rows as to search 50', () => {
        expect(searchCost(500)).toBe(searchCost(50))
    })
})

describe('a gated grid paging on the client', () => {
    const crowd = Array.from({ length: 20 }, (_, i) => ({
        id: i + 1,
        name: `Person ${i + 1}`,
        salary: 1000 + i
    }))

    function pagedGrid(): GridState<Person> {
        return createDataGrid<Person>({
            columns,
            data: crowd,
            getRowId: (row) => String(row.id),
            features: [filtering(), selection(), editing(), pagination({ pageSize: 5 }), mask()]
        })
    }

    it('substitutes the page on screen and every row behind it', () => {
        const grid = pagedGrid()
        expect(grid.nodes).toHaveLength(5)
        expect(grid.getValue(firstNode(grid), salaryColumn(grid))).toBe(MASK)

        const matrix = rowsToMatrix(grid.preWindowNodes, grid.columns.visible, undefined, {
            read: (column) => grid.readerFor(column.id, 'export')
        })
        expect(matrix).toHaveLength(20)
        expect(matrix.every((row) => row[1] === MASK)).toBe(true)

        getPagination(grid)!.setPage(3)
        expect(firstNode(grid).row.name).toBe('Person 11')
        expect(grid.getValue(firstNode(grid), salaryColumn(grid))).toBe(MASK)
    })

    it('searches the substitute across pages, not the value', () => {
        const grid = pagedGrid()
        getFiltering(grid)!.setQuickFilter('1015')
        expect(grid.nodes).toHaveLength(0)

        getFiltering(grid)!.setQuickFilter('person 15')
        expect(grid.nodes.map((node) => node.row.name)).toEqual(['Person 15'])
    })
})

describe('a gated grid on one page of a server', () => {
    const database: Person[] = Array.from({ length: 20 }, (_, i) => ({
        id: i + 1,
        name: `Person ${i + 1}`,
        salary: 1000 + i
    }))
    const pageOf = (page: number, size = 5) => database.slice((page - 1) * size, page * size)

    function serverGrid(): GridState<Person> {
        return createDataGrid<Person>({
            columns,
            data: pageOf(1),
            getRowId: (row) => String(row.id),
            rowModel: 'server',
            features: [
                filtering(),
                selection(),
                editing(),
                pagination({ pageSize: 5, rowCount: database.length }),
                mask()
            ]
        })
    }

    it('substitutes the page it holds, and the page it turns to', () => {
        const grid = serverGrid()
        expect(grid.getValue(firstNode(grid), salaryColumn(grid))).toBe(MASK)

        getPagination(grid)!.setPage(2)
        grid.data = pageOf(2)

        expect(firstNode(grid).row.name).toBe('Person 6')
        expect(grid.getValue(firstNode(grid), salaryColumn(grid))).toBe(MASK)
    })

    it('substitutes what the loaded page copies and exports', () => {
        const grid = serverGrid()
        getSelection(grid)!.selectAll()

        const copied = getSelection(grid)!.copyText()!
        expect(copied).toContain(MASK)
        expect(copied).not.toContain('1000')

        const matrix = rowsToMatrix(grid.preWindowNodes, grid.columns.visible, undefined, {
            read: (column) => grid.readerFor(column.id, 'export')
        })
        expect(matrix.every((row) => row[1] === MASK)).toBe(true)
    })

    it('substitutes the values a set filter offers for the loaded page', () => {
        expect(getFiltering(serverGrid())!.distinctFor('salary')).toEqual([MASK])
    })

    it('keeps the cell unopenable, and keeps the quick filter a pass-through', () => {
        const grid = serverGrid()
        expect(getEditing(grid)!.editableAt(firstNode(grid), salaryColumn(grid).def)).toBe(false)

        getFiltering(grid)!.setQuickFilter('1000')
        expect(grid.nodes).toHaveLength(5)
        expect(getFiltering(grid)!.model.quick).toBe('1000')
    })
})

describe('nothing reads past the gate', () => {
    const LIB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../lib')

    const allowed = new Set([
        'core/utils/value.ts',
        'core/utils/index.ts',
        'core/index.ts',
        'core/grid/value-gate.ts',
        'features/filtering/filter-predicates.ts',
        'features/worker-row-model/worker-row-model.ts'
    ])

    function sourceFiles(dir: string): string[] {
        return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
            const full = path.join(dir, entry.name)
            if (entry.isDirectory()) return sourceFiles(full)
            if (!/\.(ts|svelte)$/.test(entry.name)) return []
            if (/\.(test|spec)\.|\.test-d\./.test(entry.name)) return []
            return [full]
        })
    }

    it('keeps getCellValue behind the door', () => {
        const offenders = sourceFiles(LIB)
            .filter((file) => readFileSync(file, 'utf8').includes('getCellValue'))
            .map((file) => path.relative(LIB, file))
            .filter((file) => !allowed.has(file))

        expect(offenders).toEqual([])
    })
})
