import {
    createDataGrid,
    DataGrid,
    editing,
    filtering,
    findReplace,
    getFindReplace,
    getPagination,
    pagination,
    virtualization,
    type ColumnDef,
    type DataGridProps,
    type GridFeature,
    type GridState
} from '$lib/index.js'
import type { Component } from 'svelte'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { page } from 'vitest/browser'

interface Row {
    id: number
    name: string
}

const columns: ColumnDef<Row>[] = [{ id: 'name', header: 'Name', editable: true }]

const rows: Row[] = Array.from({ length: 24 }, (_, index) => ({
    id: index + 1,
    name: index === 15 || index === 20 ? `Silva ${index}` : `person ${index}`
}))

const TypedGrid = DataGrid as unknown as Component<DataGridProps<Row>>

async function stepToFirstMatch(features: GridFeature<Row>[]) {
    const grid: GridState<Row> = createDataGrid<Row>({
        columns,
        data: rows,
        getRowId: (row) => String(row.id),
        features: [filtering(), editing(), findReplace(), ...features]
    })
    const screen = await render(TypedGrid, { grid, class: 'h-40' } as never)
    await expect.element(page.getByRole('grid')).toBeVisible()
    const viewport = screen.container.querySelector('[role="grid"]') as HTMLElement

    const find = getFindReplace(grid)!
    find.show()
    find.query = 'Silva'
    await new Promise((resolve) => setTimeout(resolve, 50))

    find.step(1)
    await new Promise((resolve) => setTimeout(resolve, 80))
    return { grid, viewport, find }
}

describe('stepping to a match brings it into view', () => {
    it('on a grid that scrolls, which registers no virtualization', async () => {
        const { viewport, find } = await stepToFirstMatch([])

        expect(find.matches.length).toBe(2)
        expect(find.current).toBe(0)
        expect(viewport.scrollTop).toBeGreaterThan(0)
    })

    it('on a virtual grid, which had always worked', async () => {
        const { viewport } = await stepToFirstMatch([virtualization()])
        expect(viewport.scrollTop).toBeGreaterThan(0)
    })

    it('on a paged grid, by turning to the page the match is on', async () => {
        const { grid } = await stepToFirstMatch([pagination({ pageSize: 5 })])
        expect(getPagination(grid)!.page).toBe(4)
    })
})
