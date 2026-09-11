import {
    createDataGrid,
    DataGrid,
    serverRowModel,
    virtualization,
    type ColumnDef,
    type DataGridProps,
    type GridState
} from '$lib/index.js'
import type { Component } from 'svelte'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'

interface Row {
    id: number
    team: string
    name: string
    isGroup?: boolean
}

const columns: ColumnDef<Row>[] = [{ id: 'team' }, { id: 'name' }]

const groups: Row[] = ['Core', 'Growth', 'Support'].map((team, index) => ({
    id: -(index + 1),
    team,
    name: '',
    isGroup: true
}))

const TypedGrid = DataGrid as unknown as Component<DataGridProps<Row>>

function shape(container: Element) {
    const grid = container.querySelector('[role="grid"],[role="treegrid"]')!
    const row = container.querySelector('[role="row"][aria-rowindex="2"]')
    return {
        container: grid.getAttribute('role'),
        level: row?.getAttribute('aria-level') ?? null,
        expanded: row?.getAttribute('aria-expanded') ?? null
    }
}

describe('a hierarchy the server sends', () => {
    it('is drawn inside a treegrid, the way a local one is', async () => {
        const grid: GridState<Row> = createDataGrid<Row>({
            columns,
            data: [],
            getRowId: (row) => String(row.id),
            rowModel: 'server',
            features: [
                virtualization(),
                serverRowModel<Row>(
                    { getRows: async () => ({ rows: groups, rowCount: groups.length }) },
                    {
                        mode: 'paged',
                        getRowMeta: (row) =>
                            row.isGroup ? { level: 0, expandable: true } : undefined
                    }
                )
            ]
        })
        const screen = await render(TypedGrid, { grid })
        grid.feature<{ refresh: () => void }>('serverRowModel')!.refresh()
        await expect.poll(() => grid.data.length).toBeGreaterThan(0)
        await expect.poll(() => shape(screen.container).level).toBe('1')

        expect(shape(screen.container)).toEqual({
            container: 'treegrid',
            level: '1',
            expanded: 'false'
        })
    })

    it('leaves a flat server grid alone', async () => {
        const grid: GridState<Row> = createDataGrid<Row>({
            columns,
            data: [],
            getRowId: (row) => String(row.id),
            rowModel: 'server',
            features: [
                virtualization(),
                serverRowModel<Row>(
                    { getRows: async () => ({ rows: groups, rowCount: groups.length }) },
                    { mode: 'paged' }
                )
            ]
        })
        const screen = await render(TypedGrid, { grid })
        grid.feature<{ refresh: () => void }>('serverRowModel')!.refresh()
        await expect.poll(() => grid.data.length).toBeGreaterThan(0)

        expect(shape(screen.container).container).toBe('grid')
    })
})
