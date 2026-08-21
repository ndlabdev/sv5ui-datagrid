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
    getSelection,
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

/** Hides one column, for the purposes named, the way a policy feature would. */
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
        // Copied: an edit replaces a row, and the fixtures are shared.
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

        // An app's own export formatter is downstream of the gate.
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
        // The edit replaces the row, so the fresh node is the one to read.
        expect(firstNode(grid).row).toEqual({ id: 1, name: 'Ada Lovelace', salary: 9000 })
    })

    it('keeps a gated column out of a row edit, and out of what the row writes', () => {
        const grid = makeGrid([mask()], people, 'row')
        const state = getEditing(grid)!
        state.startRowEdit(firstNode(grid).id)

        expect(Object.keys(state.drafts)).toEqual(['name'])

        // Forced through the API rather than through a field the row opened:
        // the commit has to drop it too, or this is the door around the rule.
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

    /** What one copy of `size` rows costs the gate. */
    function copyCost(size: number): number {
        const { feature, asked } = counter()
        const grid = makeGrid([feature], crowd(size))
        getSelection(grid)!.selectAll()
        const before = asked()

        expect(getSelection(grid)!.copyText()).toContain(MASK)
        return asked() - before
    }

    /** What one search over `size` rows costs it. */
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

/**
 * The gate is only worth having if it is the only door. `getCellValue` is the
 * raw accessor behind it and stays exported for the features that read values
 * in bulk, so nothing but the door itself may reach for it: a call site added
 * later that reads past the gate is a value the grid was told to hide and
 * shows anyway.
 */
describe('nothing reads past the gate', () => {
    const LIB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../lib')

    const allowed = new Set([
        // The accessor itself, and the two barrels that offer it.
        'core/utils/value.ts',
        'core/utils/index.ts',
        'core/index.ts',
        // The door.
        'core/grid/value-gate.ts',
        // A predicate decides which rows survive; RFC EP5 §7 records why it
        // reads past the gate and what that costs.
        'features/filtering/filter-predicates.ts'
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
