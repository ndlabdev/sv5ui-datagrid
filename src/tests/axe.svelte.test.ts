import axe from 'axe-core'
import type { Component } from 'svelte'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import {
    createDataGrid,
    DataGrid,
    filtering,
    sorting,
    virtualization,
    type ColumnDef,
    type DataGridProps
} from '$lib/index.js'
import VirtualGrid from './VirtualGrid.svelte'

interface Person {
    id: number
    name: string
    age: number
}

const TypedDataGrid = DataGrid as unknown as Component<DataGridProps<Person>>

const people: Person[] = Array.from({ length: 20 }, (_, i) => ({
    id: i + 1,
    name: `Person ${i + 1}`,
    age: 20 + i
}))

const columns: ColumnDef<Person>[] = [
    { id: 'name', header: 'Name', sortable: true, flex: 1, minWidth: 140 },
    { id: 'age', header: 'Age', sortable: true, align: 'right', width: 100 }
]

async function expectNoViolations(container: Element) {
    const results = await axe.run(container, {
        rules: { region: { enabled: false }, 'page-has-heading-one': { enabled: false } }
    })
    const summary = results.violations.flatMap((violation) =>
        violation.nodes.map((node) => `${violation.id}: ${node.html.slice(0, 160)}`)
    )
    expect(summary).toEqual([])
}

describe('axe accessibility', () => {
    it('standard DataGrid with toolbar and pagination has no violations', async () => {
        const screen = await render(TypedDataGrid, {
            data: people,
            columns,
            getRowId: (person: Person) => String(person.id),
            pageSize: 5,
            toolbar: true
        })
        await expect.element(screen.getByRole('grid')).toBeVisible()
        await expectNoViolations(screen.container)
    })

    it('virtualized grid has no violations', async () => {
        interface Row {
            id: number
            name: string
            value: number
        }
        const rows: Row[] = Array.from({ length: 1000 }, (_, i) => ({
            id: i + 1,
            name: `Row ${i + 1}`,
            value: i
        }))
        const grid = createDataGrid<Row>({
            data: rows,
            columns: [
                { id: 'name', header: 'Name', sortable: true, flex: 1, minWidth: 120 },
                { id: 'value', header: 'Value', align: 'right', width: 100 }
            ],
            getRowId: (row) => String(row.id),
            features: [filtering(), sorting(), virtualization({ rowHeight: 40 })]
        })
        const screen = await render(VirtualGrid, { grid })
        await expect
            .element(screen.getByRole('gridcell', { name: 'Row 1', exact: true }))
            .toBeVisible()
        await expectNoViolations(screen.container)
    })

    it('empty and error states have no violations', async () => {
        const emptyScreen = await render(TypedDataGrid, {
            data: [] as Person[],
            columns,
            getRowId: (person: Person) => String(person.id),
            emptyText: 'No people'
        })
        await expect.element(emptyScreen.getByText('No people')).toBeVisible()
        await expectNoViolations(emptyScreen.container)
    })
})
