import { type Component } from 'svelte'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import {
    conditionalFormatting,
    createDataGrid,
    DataGrid,
    flashCells,
    getFlashCells,
    grouping,
    sorting,
    virtualization,
    type ColumnDef,
    type DataGridProps,
    type GridState
} from '$lib/index.js'

interface Tick {
    id: number
    symbol: string
    price: number
    size: number
    desk: string
}

const Typed = DataGrid as unknown as Component<DataGridProps<Tick>>

const start: Tick[] = Array.from({ length: 12 }, (_, at) => ({
    id: at + 1,
    symbol: `S${at + 1}`,
    price: 100 + at,
    size: 10,
    desk: at % 2 === 0 ? 'A' : 'B'
}))

const columns: ColumnDef<Tick>[] = [
    { id: 'symbol' },
    { id: 'price', type: 'number' },
    { id: 'size', type: 'number' },
    { id: 'desk' }
]

const build = (options: {
    columns?: string[]
    direction?: boolean
    duration?: number
    extra?: unknown[]
}): GridState<Tick> =>
    createDataGrid<Tick>({
        data: start,
        columns,
        getRowId: (row) => String(row.id),
        features: [
            flashCells<Tick>({
                ...(options.columns ? { columns: options.columns } : {}),
                ...(options.direction === undefined ? {} : { direction: options.direction }),
                duration: options.duration ?? 60_000
            }),
            ...((options.extra ?? []) as never[])
        ]
    })

const open = async (grid: GridState<Tick>) => {
    const screen = await render(Typed, { grid })
    await expect
        .poll(() => screen.container.querySelector('[role="grid"], [role="treegrid"]'))
        .not.toBeNull()
    return screen
}

const marked = (screen: { container: Element }) =>
    Array.from(screen.container.querySelectorAll<HTMLElement>('[data-dg-cell]')).filter((cell) =>
        cell.style.outline.includes('solid')
    )

const outlineOf = (screen: { container: Element }, text: string) =>
    marked(screen).find((cell) => (cell.textContent ?? '').trim() === text)?.style.outline ?? ''

const nudge = async (grid: GridState<Tick>, change: (row: Tick) => Tick) => {
    grid.data = grid.data.map(change)
    await new Promise((resolve) => setTimeout(resolve, 120))
}

describe('a cell says when its value changed', () => {
    it('marks nothing on the first paint, having witnessed nothing', async () => {
        const screen = await open(build({}))
        expect(marked(screen)).toEqual([])
    })

    it('marks the one cell that changed and leaves the rest alone', async () => {
        const grid = build({})
        const screen = await open(grid)

        await nudge(grid, (row) => (row.id === 1 ? { ...row, price: 999 } : row))

        await expect.poll(() => marked(screen).length).toBe(1)
        expect(marked(screen)[0]?.textContent?.trim()).toContain('999')
    })

    it('marks nothing when the data is replaced with the same values', async () => {
        const grid = build({})
        const screen = await open(grid)

        await nudge(grid, (row) => ({ ...row }))

        expect(marked(screen)).toEqual([])
    })

    it('lets go after the time it was given', async () => {
        const grid = build({ duration: 120 })
        const screen = await open(grid)

        await nudge(grid, (row) => (row.id === 1 ? { ...row, price: 500 } : row))
        await expect.poll(() => marked(screen).length).toBe(1)

        await expect.poll(() => marked(screen).length, { timeout: 2000 }).toBe(0)
    })

    it('marks a row that arrives new only once it changes, not on arrival', async () => {
        const grid = build({})
        const screen = await open(grid)

        grid.data = [...grid.data, { id: 99, symbol: 'NEW', price: 1, size: 1, desk: 'A' }]
        await new Promise((resolve) => setTimeout(resolve, 120))
        expect(marked(screen)).toEqual([])

        await nudge(grid, (row) => (row.id === 99 ? { ...row, price: 2 } : row))
        await expect.poll(() => marked(screen).length).toBe(1)
    })
})

describe('which way the value went', () => {
    it('tells a rise from a fall', async () => {
        const grid = build({})
        const screen = await open(grid)

        await nudge(grid, (row) => {
            if (row.id === 1) return { ...row, price: row.price + 5 }
            if (row.id === 2) return { ...row, price: row.price - 5 }
            return row
        })

        await expect.poll(() => marked(screen).length).toBe(2)
        expect(outlineOf(screen, '105')).toContain('success')
        expect(outlineOf(screen, '96')).toContain('error')
    })

    it('gives no direction where a value is not a number', async () => {
        const grid = build({})
        const screen = await open(grid)

        await nudge(grid, (row) => (row.id === 1 ? { ...row, desk: 'C' } : row))

        await expect.poll(() => marked(screen).length).toBe(1)
        expect(outlineOf(screen, 'C')).toContain('primary')
    })

    it('gives no direction at all when the option is off', async () => {
        const grid = build({ direction: false })
        const screen = await open(grid)

        await nudge(grid, (row) => (row.id === 1 ? { ...row, price: row.price + 5 } : row))

        await expect.poll(() => marked(screen).length).toBe(1)
        expect(outlineOf(screen, '105')).toContain('primary')
    })
})

describe('what it is told to watch', () => {
    it('watches every visible column when it was given none', async () => {
        const grid = build({})
        const screen = await open(grid)

        await nudge(grid, (row) => (row.id === 1 ? { ...row, price: 1, size: 2, desk: 'Z' } : row))

        await expect.poll(() => marked(screen).length).toBe(3)
    })

    it('watches only the columns it was given', async () => {
        const grid = build({ columns: ['price'] })
        const screen = await open(grid)

        await nudge(grid, (row) => (row.id === 1 ? { ...row, price: 1, size: 2, desk: 'Z' } : row))

        await expect.poll(() => marked(screen).length).toBe(1)
        expect(marked(screen)[0]?.textContent?.trim()).toBe('1')
    })

    it('says nothing about a column it cannot see', async () => {
        const grid = build({ columns: ['size'] })
        const screen = await open(grid)
        grid.columns.setHidden('size', true)
        await new Promise((resolve) => setTimeout(resolve, 120))

        await nudge(grid, (row) => (row.id === 1 ? { ...row, size: 77 } : row))

        expect(marked(screen)).toEqual([])
    })
})

describe('beside the features it shares a cell with', () => {
    it('leaves a colour scale its background and takes the outline', async () => {
        const grid = build({
            extra: [
                conditionalFormatting<Tick>({ rules: [{ kind: 'colorScale', column: 'price' }] })
            ]
        })
        const screen = await open(grid)

        await nudge(grid, (row) => (row.id === 1 ? { ...row, price: 999 } : row))
        await expect.poll(() => marked(screen).length).toBe(1)

        const cell = marked(screen)[0]!
        expect(cell.style.backgroundColor).not.toBe('')
        expect(cell.style.outline).toContain('solid')
    })

    it('marks a group row when what it gathers changes', async () => {
        const grid = createDataGrid<Tick>({
            data: start,
            columns,
            getRowId: (row) => String(row.id),
            features: [
                flashCells<Tick>({ duration: 60_000 }),
                grouping<Tick>({ by: ['desk'], aggregations: { price: 'sum' } })
            ]
        })
        const screen = await open(grid)

        await nudge(grid, (row) => (row.id === 1 ? { ...row, price: row.price + 1000 } : row))

        await expect.poll(() => marked(screen).length).toBeGreaterThan(0)
    })

    it('says nothing when a sort only moves the rows about', async () => {
        const grid = build({ extra: [sorting<Tick>(), virtualization<Tick>({ rowHeight: 40 })] })
        const screen = await open(grid)

        grid.api.setSort?.([{ columnId: 'price', direction: 'desc' }])
        await new Promise((resolve) => setTimeout(resolve, 150))

        expect(marked(screen)).toEqual([])
    })
})

describe('what it costs and when it does nothing', () => {
    it('remembers only the cells on screen', async () => {
        const grid = build({ extra: [virtualization<Tick>({ rowHeight: 40 })] })
        await open(grid)

        const flash = getFlashCells(grid)!
        expect(flash.duration).toBe(60_000)
        expect(flash.directional).toBe(true)
    })

    it('marks nothing for a reader who asked for less motion', async () => {
        const real = window.matchMedia
        window.matchMedia = ((query: string) =>
            ({
                matches: query.includes('prefers-reduced-motion'),
                media: query,
                addEventListener: () => {},
                removeEventListener: () => {}
            }) as unknown as MediaQueryList) as typeof window.matchMedia

        try {
            const grid = build({})
            const screen = await open(grid)
            await nudge(grid, (row) => (row.id === 1 ? { ...row, price: 999 } : row))

            expect(getFlashCells(grid)!.muted).toBe(true)
            expect(marked(screen)).toEqual([])
        } finally {
            window.matchMedia = real
        }
    })

    it('keeps remembering while muted, so unmuting does not flash the backlog', async () => {
        const real = window.matchMedia
        let quiet = true
        window.matchMedia = ((query: string) =>
            ({
                matches: quiet && query.includes('prefers-reduced-motion'),
                media: query,
                addEventListener: () => {},
                removeEventListener: () => {}
            }) as unknown as MediaQueryList) as typeof window.matchMedia

        try {
            const grid = build({})
            const screen = await open(grid)
            await nudge(grid, (row) => (row.id === 1 ? { ...row, price: 999 } : row))
            expect(marked(screen)).toEqual([])

            quiet = false
            await nudge(grid, (row) => (row.id === 2 ? { ...row, price: 777 } : row))

            await expect.poll(() => marked(screen).length).toBe(1)
            expect(marked(screen)[0]?.textContent?.trim()).toContain('777')
        } finally {
            window.matchMedia = real
        }
    })

    it('forgets everything when it is stopped', async () => {
        const grid = build({})
        const screen = await open(grid)

        await nudge(grid, (row) => (row.id === 1 ? { ...row, price: 1 } : row))
        await expect.poll(() => marked(screen).length).toBe(1)

        getFlashCells(grid)!.stop()
        await new Promise((resolve) => setTimeout(resolve, 60))

        expect(marked(screen)).toEqual([])
    })
})

describe('the demo page', () => {
    it('marks on a round, says nothing on a reshuffle, and nothing on a new row', async () => {
        const { default: FlashDemo } = await import('../routes/flash/+page.svelte')
        const screen = await render(FlashDemo as never)
        await expect
            .poll(
                () => screen.container.querySelectorAll('[role="grid"], [role="treegrid"]').length
            )
            .toBe(5)

        expect(marked(screen)).toEqual([])

        const press = async (name: string) => {
            const button = Array.from(screen.container.querySelectorAll('button')).find(
                (one) => (one.textContent ?? '').trim() === name
            )
            expect(button, name).toBeDefined()
            ;(button as HTMLElement).click()
            await new Promise((resolve) => setTimeout(resolve, 200))
        }

        await press('Một đợt, 6 ô')
        await expect.poll(() => marked(screen).length).toBeGreaterThan(0)

        await press('Thay dữ liệu, cùng giá trị')
        await expect.poll(() => marked(screen).length).toBe(0)

        await press('Thêm một hàng mới')
        const rowsMarked = marked(screen).map(
            (cell) => cell.closest('[data-dg-row-id]')?.getAttribute('data-dg-row-id') ?? ''
        )
        expect(rowsMarked.every((id) => id.startsWith('group:'))).toBe(true)
        expect(marked(screen).some((cell) => (cell.textContent ?? '').includes('MỚI'))).toBe(false)
    })

    it('leaves the note column alone on the grid that only watches the price', async () => {
        const { default: FlashDemo } = await import('../routes/flash/+page.svelte')
        const screen = await render(FlashDemo as never)
        await expect
            .poll(
                () => screen.container.querySelectorAll('[role="grid"], [role="treegrid"]').length
            )
            .toBe(5)

        const button = Array.from(screen.container.querySelectorAll('button')).find(
            (one) => (one.textContent ?? '').trim() === 'Đổi ghi chú'
        )
        ;(button as HTMLElement).click()
        await new Promise((resolve) => setTimeout(resolve, 200))

        const texts = marked(screen).map((cell) => (cell.textContent ?? '').trim())
        expect(texts.length).toBeGreaterThan(0)
        expect(texts.every((text) => text.startsWith('đổi lần'))).toBe(true)
    })
})
