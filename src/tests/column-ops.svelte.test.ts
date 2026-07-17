import type { Component } from 'svelte'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { page, userEvent } from 'vitest/browser'
import {
    columnOps,
    createDataGrid,
    DataGrid,
    getColumnOps,
    sorting,
    virtualization,
    type ColumnDef,
    type DataGridProps,
    type GridState
} from '$lib/index.js'

interface Person {
    id: number
    name: string
    email: string
    age: number
}

const TypedDataGrid = DataGrid as unknown as Component<DataGridProps<Person>>

const people: Person[] = Array.from({ length: 12 }, (_, i) => ({
    id: i + 1,
    name: `Person ${i + 1}`,
    email: `user${i + 1}@example.com`,
    age: 20 + i
}))

const flatColumns: ColumnDef<Person>[] = [
    { id: 'name', header: 'Name', sortable: true, width: 160 },
    { id: 'email', header: 'Email', width: 200 },
    { id: 'age', header: 'Age', sortable: true, align: 'right', width: 100 }
]

const getRowId = (person: Person) => String(person.id)

function pointer(target: Element, type: string, clientX: number, extra: PointerEventInit = {}) {
    target.dispatchEvent(
        new PointerEvent(type, {
            bubbles: true,
            composed: true,
            pointerId: 1,
            isPrimary: true,
            button: 0,
            clientX,
            clientY: 10,
            ...extra
        })
    )
}

function headerOrder(container: Element): string[] {
    return [...container.querySelectorAll('[data-dg-cell^="-1:"]')].map(
        (cell) => cell.textContent?.trim().split('\n')[0].trim() ?? ''
    )
}

function gridVar(
    screen: { getByRole: (role: string) => { element: () => Element } },
    name: string
): string | null {
    const style = screen.getByRole('grid').element().getAttribute('style') ?? ''
    const match = style.match(new RegExp(`${name}: ([^;]+)`))
    return match?.[1] ?? null
}

describe('column resize', () => {
    it('drag-resizes via the handle without re-creating cells', async () => {
        const screen = await render(TypedDataGrid, {
            data: people.slice(0, 4),
            columns: flatColumns,
            getRowId
        })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        const firstCell = screen.container.querySelector<HTMLElement>('[data-dg-cell="0:0"]')!
        firstCell.dataset.marker = 'kept'

        const handle = screen.container.querySelector<HTMLElement>(
            '[aria-label="Resize Name column"]'
        )!
        pointer(handle, 'pointerdown', 200)
        pointer(handle, 'pointermove', 260)
        await expect.poll(() => gridVar(screen, '--dg-col-name-w')).toBe('220px')
        pointer(handle, 'pointerup', 260)

        const again = screen.container.querySelector<HTMLElement>('[data-dg-cell="0:0"]')!
        expect(again.dataset.marker).toBe('kept')
    })

    it('clamps drag resize at minWidth', async () => {
        const screen = await render(TypedDataGrid, {
            data: people.slice(0, 3),
            columns: flatColumns,
            getRowId
        })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        const handle = screen.container.querySelector<HTMLElement>(
            '[aria-label="Resize Age column"]'
        )!
        pointer(handle, 'pointerdown', 300)
        pointer(handle, 'pointermove', 0)
        await expect.poll(() => gridVar(screen, '--dg-col-age-w')).toBe('40px')
        pointer(handle, 'pointerup', 0)
    })

    it('autosizes on double-click and via the api', async () => {
        const grid = createDataGrid<Person>({
            data: people.slice(0, 5),
            columns: flatColumns,
            getRowId,
            features: [sorting(), columnOps()]
        })
        const screen = await render(TypedDataGrid, { grid })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        const handle = screen.container.querySelector<HTMLElement>(
            '[aria-label="Resize Email column"]'
        )!
        handle.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
        await expect.poll(() => gridVar(screen, '--dg-col-email-w')).not.toBe('200px')

        const width = grid.columns.widthOf('email')!
        expect(width).toBeGreaterThan(40)
        expect(width).toBeLessThan(200)
    })

    it('resizes with Shift+Arrow on a focused header', async () => {
        const screen = await render(TypedDataGrid, {
            data: people.slice(0, 3),
            columns: flatColumns,
            getRowId
        })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        screen.container.querySelector<HTMLElement>('[data-dg-cell="-1:0"]')!.focus()
        await userEvent.keyboard('{Shift>}{ArrowRight}{/Shift}')
        await expect.poll(() => gridVar(screen, '--dg-col-name-w')).toBe('176px')
        await userEvent.keyboard('{Shift>}{ArrowLeft}{/Shift}{Shift>}{ArrowLeft}{/Shift}')
        await expect.poll(() => gridVar(screen, '--dg-col-name-w')).toBe('144px')
    })
})

describe('column reorder', () => {
    it('reorders with Alt+Arrow and follows focus', async () => {
        const screen = await render(TypedDataGrid, {
            data: people.slice(0, 3),
            columns: flatColumns,
            getRowId
        })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        screen.container.querySelector<HTMLElement>('[data-dg-cell="-1:0"]')!.focus()
        await userEvent.keyboard('{Alt>}{ArrowRight}{/Alt}')

        await expect.poll(() => headerOrder(screen.container)[0]).toContain('Email')
        expect(document.activeElement?.getAttribute('data-dg-cell')).toBe('-1:1')
    })

    it('drag-reorders with a drop indicator', async () => {
        const screen = await render(TypedDataGrid, {
            data: people.slice(0, 3),
            columns: flatColumns,
            getRowId
        })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        const nameHeader = screen.container.querySelector<HTMLElement>('[data-dg-cell="-1:0"]')!
        const startX = nameHeader.getBoundingClientRect().left + 20
        pointer(nameHeader, 'pointerdown', startX)
        pointer(nameHeader, 'pointermove', startX + 250)
        await expect
            .poll(() => screen.container.querySelector('[class*="bg-primary"][class*="w-0.5"]'))
            .not.toBeNull()
        pointer(nameHeader, 'pointerup', startX + 250)

        await expect.poll(() => headerOrder(screen.container)[0]).toContain('Email')
    })

    it('suppresses the trailing click after a drag so it does not sort', async () => {
        const screen = await render(TypedDataGrid, {
            data: people.slice(0, 4),
            columns: flatColumns,
            getRowId
        })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        const nameHeader = screen.container.querySelector<HTMLElement>('[data-dg-cell="-1:0"]')!
        const startX = nameHeader.getBoundingClientRect().left + 20
        pointer(nameHeader, 'pointerdown', startX)
        pointer(nameHeader, 'pointermove', startX + 250)
        pointer(nameHeader, 'pointerup', startX + 250)
        nameHeader.dispatchEvent(new MouseEvent('click', { bubbles: true }))

        await expect.poll(() => headerOrder(screen.container)[0]).toContain('Email')
        expect(screen.container.querySelector('[aria-sort]')).toBeNull()

        await screen.getByRole('button', { name: 'Name', exact: true }).click()
        await expect
            .element(screen.getByRole('columnheader', { name: 'Name' }))
            .toHaveAttribute('aria-sort', 'ascending')
    })
})

describe('pinning', () => {
    interface Row {
        id: number
        name: string
        value: number
    }

    it('keeps pinned columns fixed while scrolling horizontally', async () => {
        const wideColumns: ColumnDef<Row>[] = [
            { id: 'name', header: 'Name', width: 150, pinned: 'left' },
            ...Array.from({ length: 15 }, (_, i) => ({
                id: `c${i}`,
                header: `C${i}`,
                width: 120,
                accessor: (row: Row) => `${i}:${row.id}`
            })),
            { id: 'value', header: 'Value', width: 100, pinned: 'right' }
        ]
        const grid = createDataGrid<Row>({
            data: Array.from({ length: 50 }, (_, i) => ({
                id: i + 1,
                name: `Row ${i + 1}`,
                value: i
            })),
            columns: wideColumns,
            getRowId: (row) => String(row.id),
            features: [columnOps(), virtualization({ rowHeight: 40, columns: true })]
        })
        const TypedWide = DataGrid as unknown as Component<DataGridProps<Row>>
        const screen = await render(TypedWide, { grid, class: 'h-100' } as never)
        await expect
            .element(screen.getByRole('gridcell', { name: 'Row 1', exact: true }))
            .toBeVisible()

        const pinnedCell = screen.container.querySelector<HTMLElement>('[data-dg-cell="0:0"]')!
        const before = pinnedCell.getBoundingClientRect().left

        const viewport = screen.getByRole('grid').element() as HTMLElement
        viewport.scrollLeft = 600
        await expect
            .poll(
                () =>
                    screen.container
                        .querySelector<HTMLElement>('[data-dg-cell="0:0"]')
                        ?.getBoundingClientRect().left
            )
            .toBe(before)

        const rightPinned = [
            ...screen.container.querySelectorAll<HTMLElement>('[role="columnheader"]')
        ].find((cell) => cell.textContent?.includes('Value'))
        expect(rightPinned?.className).toContain('sticky')
    })
})

describe('column menu + chooser + state round-trip', () => {
    it('opens the column menu with Alt+ArrowDown and pins via menu', async () => {
        const grid = createDataGrid<Person>({
            data: people.slice(0, 4),
            columns: flatColumns,
            getRowId,
            features: [sorting(), columnOps()]
        })
        const screen = await render(TypedDataGrid, { grid })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        screen.container.querySelector<HTMLElement>('[data-dg-cell="-1:1"]')!.focus()
        await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}')
        expect(getColumnOps(grid)!.menuFor).toBe('email')

        await expect.element(page.getByRole('menuitem', { name: /Pin left/ })).toBeVisible()
        await page.getByRole('menuitem', { name: /Pin left/ }).click()

        await expect.poll(() => grid.columns.visible[0].id).toBe('email')
        expect(screen.container.querySelector('[aria-live="polite"]')?.textContent).toBe(
            'Email column pinned left'
        )
    })

    it('toggles visibility through the toolbar chooser', async () => {
        const screen = await render(TypedDataGrid, {
            data: people.slice(0, 4),
            columns: flatColumns,
            getRowId,
            toolbar: true
        })
        await expect.element(screen.getByRole('grid')).toHaveAttribute('aria-colcount', '3')

        await screen.getByRole('button', { name: 'Choose columns' }).click()
        await page.getByRole('menuitemcheckbox', { name: /Email/ }).click()

        await expect.element(screen.getByRole('grid')).toHaveAttribute('aria-colcount', '2')
    })

    it('round-trips the full column state through the api (exit criteria)', async () => {
        const grid = createDataGrid<Person>({
            data: people.slice(0, 4),
            columns: flatColumns,
            getRowId,
            features: [sorting(), columnOps()]
        })
        const screen = await render(TypedDataGrid, { grid })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        const ops = getColumnOps(grid)!
        const initial = ops.getColumnState()
        const initialOrder = headerOrder(screen.container)

        ops.moveColumn('name', 2)
        ops.pinColumn('age', 'left')
        ops.setColumnWidth('email', 260)
        ops.setColumnHidden('name', true)
        await expect.poll(() => headerOrder(screen.container)).not.toEqual(initialOrder)

        ops.applyColumnState(initial)
        await expect.poll(() => headerOrder(screen.container)).toEqual(initialOrder)
        expect(gridVar(screen, '--dg-col-email-w')).toBe('200px')
    })
})

describe('header groups', () => {
    const groupedColumns: ColumnDef<Person>[] = [
        {
            id: 'identity',
            header: 'Identity',
            children: [
                { id: 'name', header: 'Name', sortable: true, width: 160 },
                { id: 'email', header: 'Email', width: 200 }
            ]
        },
        { id: 'age', header: 'Age', align: 'right', width: 100 }
    ]

    it('renders group cells with aria-colspan and a taller header', async () => {
        const screen = await render(TypedDataGrid, {
            data: people.slice(0, 3),
            columns: groupedColumns,
            getRowId
        })

        const group = screen.getByRole('columnheader', { name: 'Identity' })
        await expect.element(group).toHaveAttribute('aria-colspan', '2')
        await expect.element(screen.getByRole('grid')).toHaveAttribute('aria-rowcount', '5')

        const rows = screen.container.querySelectorAll('[role="rowgroup"]:first-child [role="row"]')
        expect(rows).toHaveLength(2)
    })

    it('group resize distributes width across children', async () => {
        const screen = await render(TypedDataGrid, {
            data: people.slice(0, 3),
            columns: groupedColumns,
            getRowId
        })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        const handle = screen.container.querySelector<HTMLElement>(
            '[aria-label="Resize Identity group"]'
        )!
        pointer(handle, 'pointerdown', 400)
        pointer(handle, 'pointermove', 490)
        await expect.poll(() => gridVar(screen, '--dg-col-name-w')).toBe('200px')
        expect(gridVar(screen, '--dg-col-email-w')).toBe('250px')
        pointer(handle, 'pointerup', 490)
    })

    it('keyboard reorder stays within the group', async () => {
        const grid = createDataGrid<Person>({
            data: people.slice(0, 3),
            columns: groupedColumns,
            getRowId,
            features: [sorting(), columnOps()]
        }) as GridState<Person>
        const screen = await render(TypedDataGrid, { grid })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        screen.container.querySelector<HTMLElement>('[data-dg-cell="-1:1"]')!.focus()
        await userEvent.keyboard('{Alt>}{ArrowRight}{/Alt}')

        expect(grid.columns.visible.map((column) => column.id)).toEqual(['name', 'email', 'age'])
    })
})
