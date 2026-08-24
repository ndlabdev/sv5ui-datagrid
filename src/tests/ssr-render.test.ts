import { describe, expect, it } from 'vitest'
import { render } from 'svelte/server'
import { columnOps, createDataGrid, DataGrid, type ColumnDef } from '$lib/index.js'

interface Row {
    id: number
    total: number
    base: number
}

/**
 * A group's own `collapsed` is state the first paint has to get right: it is
 * settled before anything mounts, so the server owes the same markup the
 * client would draw, and a fold worked out on the client alone would show the
 * detail columns for a frame and then take them away.
 */
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
