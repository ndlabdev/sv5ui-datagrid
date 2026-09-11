import {
    createDataGrid,
    DataGrid,
    virtualization,
    type ColumnDef,
    type DataGridProps,
    type GridFeature
} from '$lib/index.js'
import type { Component } from 'svelte'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { page } from 'vitest/browser'

interface Row {
    id: number
    name: string
}

const columns: ColumnDef<Row>[] = [{ id: 'name', header: 'Name' }]
const rows: Row[] = Array.from({ length: 40 }, (_, index) => ({
    id: index + 1,
    name: `row ${index + 1}`
}))

const TypedGrid = DataGrid as unknown as Component<DataGridProps<Row>>

async function boxes(features: GridFeature<Row>[]) {
    const grid = createDataGrid<Row>({
        columns,
        data: rows,
        getRowId: (row) => String(row.id),
        features
    })
    const screen = await render(TypedGrid, { grid, class: 'h-40' } as never)
    await expect.element(page.getByRole('grid')).toBeVisible()

    const viewport = screen.container.querySelector('[role="grid"]') as HTMLElement
    const root = viewport.closest('[class*="space-y-3"]') as HTMLElement
    return {
        viewport: Math.round(viewport.getBoundingClientRect().height),
        paintsBelowItsBox:
            viewport.getBoundingClientRect().bottom > root.getBoundingClientRect().bottom,
        scrolls: viewport.scrollHeight > viewport.clientHeight
    }
}

describe('a height handed to DataGrid', () => {
    it('holds the rows inside it on a grid with no virtualization', async () => {
        expect(await boxes([])).toEqual({ viewport: 160, paintsBelowItsBox: false, scrolls: true })
    })

    it('does the same on a virtual grid, so registering a feature moves nothing', async () => {
        expect(await boxes([virtualization()])).toEqual({
            viewport: 160,
            paintsBelowItsBox: false,
            scrolls: true
        })
    })
})
