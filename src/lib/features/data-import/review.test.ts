import { createDataGrid } from '../../core/grid/index.js'
import { type ColumnDef } from '../../core/types/index.js'
import { editing } from '../../features/editing/index.js'
import { describe, expect, it } from 'vitest'
import { dataImport, getDataImport } from './data-import.svelte.js'

interface Row {
    id: number
    name: string
    qty: number
}

const columns: ColumnDef<Row>[] = [
    { id: 'name', header: 'Name', editable: true },
    {
        id: 'qty',
        header: 'Qty',
        type: 'number',
        editable: true,
        validate: (value) => (Number(value) > 0 ? null : 'Qty must be positive')
    }
]

const FILE = 'Name,Qty\nChi,3\nAn,abc\n'

function makeGrid(existing: Row[] = [{ id: 1, name: 'Existing', qty: 1 }]) {
    return createDataGrid<Row>({
        columns,
        data: existing,
        getRowId: (row) => String(row.id),
        features: [
            editing(),
            dataImport<Row>({ onCommit: () => {}, newRow: (index) => ({ id: 100 + index }) })
        ]
    })
}

async function reviewed(grid: ReturnType<typeof makeGrid>) {
    const importing = getDataImport(grid)!
    await importing.takeText(FILE)
    await importing.review()
    return importing
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 20))

describe('a staged row is a row the grid owns', () => {
    it('carries the id the app would give it, not one the import made up', async () => {
        const grid = makeGrid()
        await reviewed(grid)

        expect(grid.preWindowNodes.map((node) => node.id)).toEqual(['1', '100', '101'])
    })

    it('can be edited, which is the whole point of reviewing in the grid', async () => {
        const grid = makeGrid()
        const importing = await reviewed(grid)

        grid.api.applyEdits?.([{ rowId: '101', changes: { qty: 9 } }])
        await settle()

        expect(grid.preWindowNodes.at(-1)!.row.qty).toBe(9)
        expect(importing.staged.at(-1)!.qty).toBe(9)
    })

    it('clears the mark once the cell is fixed', async () => {
        const grid = makeGrid()
        const importing = await reviewed(grid)
        expect(importing.badRows.size).toBe(1)

        grid.api.applyEdits?.([{ rowId: '101', changes: { qty: 9 } }])
        await settle()

        expect(importing.problems).toEqual([])
        expect(importing.badRows.size).toBe(0)
    })

    it('cannot be edited into something the column refuses', async () => {
        const grid = makeGrid()
        const importing = await reviewed(grid)

        grid.api.applyEdits?.([{ rowId: '100', changes: { qty: -5 } }])
        await settle()

        expect(grid.data.find((row) => row.id === 100)!.qty).toBe(3)
        expect(importing.problems.map((problem) => problem.columnId)).toEqual(['qty'])
        expect(importing.problems[0]!.rowIndex).toBe(1)
    })

    it('commits the fixed value, not the one that was read', async () => {
        const handed: Row[][] = []
        const grid = createDataGrid<Row>({
            columns,
            data: [],
            getRowId: (row) => String(row.id),
            features: [
                editing(),
                dataImport<Row>({
                    onCommit: (rows) => {
                        handed.push(rows)
                    },
                    newRow: (index) => ({ id: 100 + index })
                })
            ]
        })
        const importing = getDataImport(grid)!
        await importing.takeText(FILE)
        await importing.review()

        grid.api.applyEdits?.([{ rowId: '101', changes: { qty: 9 } }])
        await settle()
        await importing.commit()

        expect(handed[0]!.map((row) => row.qty)).toEqual([3, 9])
    })
})

describe('the grid goes back to what it was', () => {
    it('after cancelling', async () => {
        const grid = makeGrid()
        const importing = await reviewed(grid)
        expect(grid.data).toHaveLength(3)

        importing.cancel()
        expect(grid.data.map((row) => row.id)).toEqual([1])
    })

    it('after stepping back to the mapping', async () => {
        const grid = makeGrid()
        const importing = await reviewed(grid)

        importing.back()
        expect(grid.data.map((row) => row.id)).toEqual([1])
        expect(importing.step).toBe('mapping')
    })

    it('after committing, so the app decides what lands', async () => {
        const grid = makeGrid()
        const importing = await reviewed(grid)

        await importing.commit()
        expect(grid.data.map((row) => row.id)).toEqual([1])
    })

    it('even when a second file is reviewed without cancelling the first', async () => {
        const grid = makeGrid()
        const importing = await reviewed(grid)

        await importing.takeText('Name,Qty\nMai,5\n')
        await importing.review()

        expect(grid.data.map((row) => row.id)).toEqual([1, 100])
    })
})

describe('the wizard refuses rather than getting stuck', () => {
    it('keeps a review intact when an unreadable file is dropped onto it', async () => {
        const grid = makeGrid()
        const importing = await reviewed(grid)

        await importing.take(new File(['x'], 'report.pdf'))

        expect(importing.step).toBe('review')
        expect(importing.error).toContain('report.pdf')
        expect(grid.data).toHaveLength(3)
    })

    it('will not review a file with no column matched to anything', async () => {
        const grid = makeGrid()
        const importing = getDataImport(grid)!
        await importing.takeText(FILE)

        for (const mapping of importing.mappings) importing.setMapping(mapping.columnId, null)

        expect(importing.canReview).toBe(false)
        await importing.review()
        expect(importing.step).toBe('mapping')
        expect(grid.data).toHaveLength(1)
    })
})

describe('state that moves while a review is open', () => {
    it('keeps a row the app added, and removes only what it staged', async () => {
        const grid = makeGrid()
        const importing = await reviewed(grid)

        grid.data = [...grid.data, { id: 7, name: 'added by the app', qty: 1 }]
        importing.cancel()

        expect(grid.data.map((row) => row.id)).toEqual([1, 7])
    })

    it('leaves the review when the header line is reinterpreted', async () => {
        const grid = makeGrid()
        const importing = await reviewed(grid)

        importing.setHasHeader(false)

        expect(importing.step).toBe('mapping')
        expect(grid.data.map((row) => row.id)).toEqual([1])
    })

    it('leaves the review when a column is mapped somewhere else', async () => {
        const grid = makeGrid()
        const importing = await reviewed(grid)

        importing.setMapping('qty', null)

        expect(importing.step).toBe('mapping')
        expect(grid.data.map((row) => row.id)).toEqual([1])
    })
})
