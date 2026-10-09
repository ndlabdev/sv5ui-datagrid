import { describe, expect, it } from 'vitest'
import { render } from 'svelte/server'
import { columnOps, createDataGrid, DataGrid, type ColumnDef } from '$lib/index.js'

interface Row {
    id: number
    total: number
    base: number
}

describe('server render', () => {
    const columns: ColumnDef<Row>[] = [
        { id: 'id', header: '#', width: 70 },
        {
            id: 'pay',
            header: 'Pay',
            collapsed: true,
            children: [
                { id: 'total', header: 'Total', width: 110, columnGroupShow: 'closed' },
                { id: 'base', header: 'Base', width: 110, columnGroupShow: 'open' }
            ]
        }
    ]

    function html(defs: ColumnDef<Row>[]): string {
        const grid = createDataGrid<Row>({
            columns: defs,
            data: [{ id: 1, total: 3, base: 2 }],
            getRowId: (row) => String(row.id),
            features: [columnOps()]
        })
        return render(DataGrid as never, { props: { grid } as never }).body
    }

    it('draws a group that starts folded as folded', () => {
        const body = html(columns)

        expect(body).toContain('Total')
        expect(body).not.toContain('>Base<')
        expect(body).toContain('aria-expanded="false"')
    })

    it('draws the same group open when it does not start folded', () => {
        const [id, pay] = columns
        const body = html([id!, { ...pay!, collapsed: false }])

        expect(body).toContain('>Base<')
        expect(body).not.toContain('>Total<')
        expect(body).toContain('aria-expanded="true"')
    })
})

describe('a grid handed in from outside', () => {
    const defs: ColumnDef<Row>[] = [{ id: 'id', header: '#', width: 70 }]
    const rows = [{ id: 1, total: 3, base: 2 }]

    function bodyFor(data: Row[]): string {
        const grid = createDataGrid<Row>({
            columns: defs,
            data,
            getRowId: (row) => String(row.id)
        })
        return render(DataGrid as never, { props: { grid } as never }).body
    }

    it('draws the rows it was created with', () => {
        expect(bodyFor(rows)).toContain('>1<')
    })

    it('draws nothing when it was created empty, because no effect runs here', () => {
        const grid = createDataGrid<Row>({
            columns: defs,
            data: [],
            getRowId: (row) => String(row.id)
        })

        const body = render(DataGrid as never, { props: { grid } as never }).body
        grid.data = rows

        expect(body).not.toContain('>1<')
        expect(grid.data).toHaveLength(1)
    })
})
