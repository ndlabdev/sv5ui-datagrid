import { createDataGrid, type GridState } from '../../core/grid/index.js'
import { type ColumnDef } from '../../core/types/index.js'
import { filtering } from '../../features/filtering/index.js'
import { sorting } from '../../features/sorting/index.js'
import { virtualization } from '../../features/virtualization/index.js'
import { describe, expect, it, vi } from 'vitest'
import { advancedFilter, getAdvancedFilter } from '../advanced-filter/index.js'
import { conditionalFormatting } from '../conditional-formatting/index.js'
import { formula } from '../formula/index.js'
import { getGrouping, grouping } from '../grouping/index.js'
import { serverRowModel } from '../server-row-model/index.js'
import { dataImport, getDataImport } from './data-import.svelte.js'

interface Line {
    id: number
    name: string
    dept: string
    unit: number
    qty: number
    total?: number
}

const existing: Line[] = [
    { id: 1, name: 'Chi', dept: 'Core', unit: 100, qty: 2 },
    { id: 2, name: 'An', dept: 'Data', unit: 50, qty: 1 }
]

const columns: ColumnDef<Line>[] = [
    { id: 'name', header: 'Name', filter: 'text' },
    { id: 'dept', header: 'Dept', filter: 'text' },
    { id: 'unit', header: 'Unit', type: 'currency', filter: 'number' },
    { id: 'qty', header: 'Qty', type: 'number', filter: 'number' },
    { id: 'total', header: 'Total', type: 'currency', filter: 'number' }
]

const FILE = 'Name,Dept,Unit,Qty\nBình,Core,200,3\nDũng,Growth,abc,1\n'

function makeGrid(extra: ReturnType<typeof formula<Line>>[] = []): GridState<Line> {
    return createDataGrid<Line>({
        columns,
        data: existing,
        getRowId: (row) => String(row.id),
        features: [
            sorting(),
            filtering(),
            ...extra,
            dataImport<Line>({
                onCommit: () => {},
                newRow: (index) => ({ id: 100 + index })
            })
        ]
    })
}

async function staged(grid: GridState<Line>) {
    const importing = getDataImport(grid)!
    await importing.takeText(FILE)
    await importing.review()
    return importing
}

describe('staged rows are ordinary rows', () => {
    it('shows them in the grid next to what was already there', async () => {
        const grid = makeGrid()
        await staged(grid)

        expect(grid.preWindowNodes).toHaveLength(existing.length + 2)
        expect(grid.preWindowNodes.at(-1)!.row.name).toBe('Dũng')
    })

    it('leaves the grid alone once the import is cancelled', async () => {
        const grid = makeGrid()
        const importing = await staged(grid)
        importing.cancel()

        expect(grid.preWindowNodes).toHaveLength(existing.length)
    })

    it('paints the cell it could not read, and only that one', async () => {
        const grid = makeGrid()
        const importing = await staged(grid)

        const bad = grid.preWindowNodes.at(-1)!
        expect(importing.decoration(bad, 'unit')?.class).toContain('error')
        expect(importing.decoration(bad, 'name')?.class).not.toContain('error')
        expect(importing.decoration(grid.preWindowNodes[0]!, 'unit')).toBeUndefined()
    })
})

describe('crossing the import with the features already here', () => {
    it('computes a formula column for the rows being reviewed', async () => {
        const grid = makeGrid([formula<Line>({ columns: { total: 'unit * qty' } })])
        await staged(grid)

        const bình = grid.preWindowNodes.find((node) => node.row.name === 'Bình')!
        expect(bình.row.total).toBe(600)
    })

    it('lets a filter narrow the review', async () => {
        const grid = makeGrid()
        await staged(grid)

        grid.api.setColumnFilter!('dept', { kind: 'text', op: 'equals', value: 'Core' })

        const names = grid.preWindowNodes.map((node) => node.row.name)
        expect(names).toContain('Chi')
        expect(names).toContain('Bình')
        expect(names).not.toContain('Dũng')
    })

    it('lets an advanced filter tree narrow the review too', async () => {
        const grid = createDataGrid<Line>({
            columns,
            data: existing,
            getRowId: (row) => String(row.id),
            features: [
                filtering(),
                advancedFilter<Line>(),
                dataImport<Line>({ onCommit: () => {}, newRow: (index) => ({ id: 100 + index }) })
            ]
        })
        await staged(grid)

        getAdvancedFilter(grid)!.setModel({
            kind: 'group',
            join: 'and',
            children: [{ kind: 'condition', columnId: 'dept', op: 'equals', value: 'Growth' }]
        })

        expect(grid.preWindowNodes.map((node) => node.row.name)).toEqual(['Dũng'])
    })

    it('groups the staged rows with the rest', async () => {
        const grid = createDataGrid<Line>({
            columns,
            data: existing,
            getRowId: (row) => String(row.id),
            features: [
                grouping<Line>({ by: ['dept'] }),
                dataImport<Line>({ onCommit: () => {}, newRow: (index) => ({ id: 100 + index }) })
            ]
        })
        await staged(grid)

        const groups = grid.preWindowNodes.filter((node) => node.meta?.expandable)
        expect(groups.length).toBeGreaterThan(0)
        expect(getGrouping(grid)!.by).toEqual(['dept'])

        const leaves = grid.preWindowNodes.filter((node) => !node.meta?.expandable)
        expect(leaves.map((node) => node.row.name)).toContain('Bình')
    })

    it('does not fight conditional formatting over the same cell', async () => {
        const grid = createDataGrid<Line>({
            columns,
            data: existing,
            getRowId: (row) => String(row.id),
            features: [
                conditionalFormatting<Line>({ rules: [{ kind: 'expression', when: 'qty > 2' }] }),
                dataImport<Line>({ onCommit: () => {}, newRow: (index) => ({ id: 100 + index }) })
            ]
        })
        const importing = await staged(grid)

        const bình = grid.preWindowNodes.find((node) => node.row.name === 'Bình')!
        expect(importing.decoration(bình, 'qty')?.class).toBeTruthy()
    })

    it('refuses to stage into a grid whose rows a server owns', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const grid = createDataGrid<Line>({
            columns,
            data: [],
            rowModel: 'server',
            getRowId: (row) => String(row.id),
            features: [
                virtualization({ rowHeight: 40 }),
                serverRowModel<Line>(
                    {
                        getRows: async () => ({ rows: [], rowCount: 0 })
                    },
                    { mode: 'infinite', blockSize: 10, placeholder: (i) => ({ id: -i }) as Line }
                ),
                dataImport<Line>({ onCommit: () => {} })
            ]
        })

        const importing = getDataImport(grid)!
        await importing.takeText(FILE)

        expect(importing.error).toBeTruthy()
        expect(importing.step).toBe('idle')
        warn.mockRestore()
    })
})

describe('committing', () => {
    it('hands over only the rows that are ready when asked', async () => {
        const handed: Line[][] = []
        const grid = createDataGrid<Line>({
            columns,
            data: existing,
            getRowId: (row) => String(row.id),
            features: [
                dataImport<Line>({
                    onCommit: (rows) => {
                        handed.push(rows)
                    },
                    newRow: (index) => ({ id: 100 + index })
                })
            ]
        })
        const importing = await staged(grid)
        await importing.commit({ validOnly: true })

        expect(handed[0]!.map((row) => row.name)).toEqual(['Bình'])
        expect(importing.step).toBe('idle')
    })

    it('hands over a row without the mark it wore while staged', async () => {
        const handed: Line[][] = []
        const grid = createDataGrid<Line>({
            columns,
            data: existing,
            getRowId: (row) => String(row.id),
            features: [
                dataImport<Line>({
                    onCommit: (rows) => {
                        handed.push(rows)
                    },
                    newRow: (index) => ({ id: 100 + index })
                })
            ]
        })
        const importing = await staged(grid)
        await importing.commit()

        expect(Object.keys(handed[0]![0]!)).not.toContain('__dgSynthetic')
    })

    it('keeps the staged rows when a commit throws', async () => {
        const grid = createDataGrid<Line>({
            columns,
            data: existing,
            getRowId: (row) => String(row.id),
            features: [
                dataImport<Line>({
                    onCommit: () => {
                        throw new Error('the server said no')
                    }
                })
            ]
        })
        const importing = await staged(grid)
        await importing.commit()

        expect(importing.error).toBe('the server said no')
        expect(importing.staged).toHaveLength(2)
    })
})
