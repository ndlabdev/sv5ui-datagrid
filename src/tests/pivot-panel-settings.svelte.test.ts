import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { page } from 'vitest/browser'
import { createDataGrid, type ColumnDef, type GridState } from '$lib/index.js'
import { viVN } from '$lib/locales/index.js'
import PivotPanel from '../lib/components/panels/PivotPanel.svelte'
import { getPivot, isPivotColumn, pivot } from '../lib/features/pivot/index.js'
import { InGrid } from './fixtures/in-root.js'

interface Sale {
    id: number
    region: string
    product: string
    quarter: string
    amount: number
}

const sales: Sale[] = Array.from({ length: 24 }, (_, index) => ({
    id: index + 1,
    region: `R${index % 8}`,
    product: index % 2 === 0 ? 'Widget' : 'Gadget',
    quarter: `Q${(index % 3) + 1}`,
    amount: 10 * (index + 1)
}))

const columns: ColumnDef<Sale>[] = [
    { id: 'region' },
    { id: 'product' },
    { id: 'quarter' },
    { id: 'amount', type: 'number' }
]

function makeGrid(across = ['quarter']): GridState<Sale> {
    return createDataGrid<Sale>({
        columns,
        data: sales,
        getRowId: (sale) => String(sale.id),
        locales: [viVN],
        locale: 'vi-VN',
        features: [
            pivot<Sale>({
                rows: ['region'],
                columns: across,
                values: [{ field: 'amount', agg: 'sum' }]
            })
        ]
    })
}

const settings = () =>
    document.querySelector('[data-dg-pivot-zone="settings"]') as HTMLElement | null

const state = (grid: GridState<Sale>) => getPivot(grid)!

const leaves = (grid: GridState<Sale>) =>
    grid.columns.visible
        .filter((column) => isPivotColumn(column.id))
        .map((c) => String(c.def.header))

async function open(grid: GridState<Sale>) {
    render(InGrid, { props: { grid, component: PivotPanel } })
    await expect.element(page.getByRole('group', { name: 'Cách đọc' })).toBeVisible()
}

describe('the panel adjusts how a crossing reads', () => {
    it('draws a zone of its own, named for a reader who cannot see it', async () => {
        const grid = makeGrid()
        await open(grid)

        expect(settings()).not.toBeNull()
        expect(settings()?.getAttribute('role')).toBe('group')
    })

    it('turns the total column on and off', async () => {
        const grid = makeGrid()
        await open(grid)
        expect(state(grid).totalColumn).toBeUndefined()

        await page.getByRole('button', { name: 'Cột tổng' }).click()
        await expect.poll(() => state(grid).totalColumn).toBe('Cột tổng')
        expect(leaves(grid)).toContain('Cột tổng')

        await page.getByRole('button', { name: 'Cột tổng' }).first().click()
        await expect.poll(() => state(grid).totalColumn).toBeUndefined()
    })

    it('turns the total row on', async () => {
        const grid = makeGrid()
        await open(grid)
        const before = grid.preWindowNodes.length

        await page.getByRole('button', { name: 'Hàng tổng' }).click()

        await expect.poll(() => grid.preWindowNodes.length).toBe(before + 1)
    })

    it('turns the subtotals on for a nested column axis', async () => {
        const grid = makeGrid(['quarter', 'product'])
        await open(grid)

        await page.getByRole('button', { name: 'Tổng con' }).click()

        await expect.poll(() => state(grid).columnSubtotal).toBeTypeOf('function')
        expect(leaves(grid).some((header) => header.endsWith('cộng'))).toBe(true)
    })

    it('lets the column groups fold, and lets the crossings sort', async () => {
        const grid = makeGrid(['quarter', 'product'])
        await open(grid)

        await page.getByRole('button', { name: 'Cho gập nhóm cột' }).click()
        await expect.poll(() => state(grid).columnGroups).toBe('open')

        await page.getByRole('button', { name: 'Cho sắp theo cột giao' }).click()
        await expect.poll(() => state(grid).sortableColumns).toBe(true)
    })

    it('keeps only the largest rows, then gathers the rest', async () => {
        const grid = makeGrid()
        await open(grid)
        expect(grid.preWindowNodes).toHaveLength(8)

        await page.getByRole('button', { name: 'Giữ hàng' }).click()
        await page.getByRole('menuitem', { name: '5 hàng lớn nhất' }).click()
        await expect.poll(() => grid.preWindowNodes.length).toBe(5)

        await page.getByRole('button', { name: 'Gom phần còn lại' }).click()
        await expect.poll(() => grid.preWindowNodes.length).toBe(6)
        expect(state(grid).keepRows?.others).toBe('Gom phần còn lại')
    })

    it('says whether each setting is on, not only by how it is filled', async () => {
        const grid = makeGrid()
        await open(grid)

        const pressed = () =>
            Array.from(settings()?.querySelectorAll('[aria-pressed]') ?? []).map((node) =>
                node.getAttribute('aria-pressed')
            )

        expect(pressed()).toEqual(['false', 'false', 'false', 'false', 'false', 'false'])

        await page.getByRole('button', { name: 'Hàng tổng' }).click()
        await expect.poll(() => pressed()[1]).toBe('true')
    })

    it('names the control by what it is for, not by the value it happens to hold', async () => {
        const grid = makeGrid()
        await open(grid)

        const button = () =>
            settings()?.querySelector('[aria-label="Giữ hàng"]') as HTMLElement | null

        expect(button()?.textContent?.trim()).toBe('Mọi hàng')

        await page.getByRole('button', { name: 'Giữ hàng' }).click()
        await page.getByRole('menuitem', { name: '5 hàng lớn nhất' }).click()

        await expect.poll(() => button()?.textContent?.trim()).toBe('5 hàng lớn nhất')
        expect(button()?.getAttribute('aria-label')).toBe('Giữ hàng')
    })

    it('does not claim every row when the state kept the smallest few', async () => {
        const grid = makeGrid()
        await open(grid)

        state(grid).setKeepRows({ bottom: 3 })

        await expect
            .poll(() => settings()?.querySelector('[aria-label="Giữ hàng"]')?.textContent?.trim())
            .toBe('3 hàng nhỏ nhất')
    })

    it('says what belongs in each zone, not only what the zone is called', async () => {
        const grid = makeGrid()
        await open(grid)

        const hints = Array.from(document.querySelectorAll('[data-dg-pivot-zone]')).map(
            (zone) =>
                Array.from(zone.querySelectorAll(':scope > span'))[1]?.textContent?.trim() ?? ''
        )

        expect(hints).toEqual([
            'Trường gom xuống dọc trang',
            'Trường gom ngang trang',
            'Cái được đo ở chỗ hai trục gặp nhau',
            'Tổng, gập nhóm, sắp xếp, và giữ bao nhiêu hàng'
        ])
    })

    it('never puts an axis name on a control that does not set an axis', async () => {
        const grid = makeGrid()
        await open(grid)

        const zoneNames = ['Chạy dọc', 'Chạy ngang']
        const wearing = Array.from(document.querySelectorAll('[data-dg-pivot-zone] button')).filter(
            (button) => zoneNames.includes((button.textContent ?? '').trim())
        )

        expect(wearing).toEqual([])
    })

    it('puts the measure axis among the settings, where the other readings are', async () => {
        const grid = makeGrid()
        await open(grid)

        const toggle = page.getByRole('button', { name: 'Measure xếp dọc' })
        await expect.element(toggle).toBeVisible()

        await toggle.click()
        await expect.poll(() => grid.api.pivotValuesOn?.()).toBe('rows')
    })

    it('shows nothing of itself until a crossing stands', async () => {
        const grid = makeGrid()
        render(InGrid, { props: { grid, component: PivotPanel } })
        await expect.element(page.getByRole('group', { name: 'Cách đọc' })).toBeVisible()

        state(grid).clearPivot()
        await expect.poll(() => settings()).toBeNull()
    })
})

describe('opening the row axis from the panel', () => {
    function nestedGrid(): GridState<Sale> {
        return createDataGrid<Sale>({
            columns,
            data: sales,
            getRowId: (sale) => String(sale.id),
            locales: [viVN],
            locale: 'vi-VN',
            features: [
                pivot<Sale>({
                    rows: ['region', 'product'],
                    columns: ['quarter'],
                    values: [{ field: 'amount', agg: 'sum' }]
                })
            ]
        })
    }

    const tiers = (grid: GridState<Sale>) =>
        new Set(grid.preWindowNodes.map((node) => node.meta?.level ?? 0))

    it('offers the control only where the axis can nest', async () => {
        const flat = makeGrid()
        await open(flat)
        expect(settings()?.textContent).not.toContain('Bung hết tầng')
    })

    it('opens every tier, then shuts them, from the one button', async () => {
        const grid = nestedGrid()
        await open(grid)

        expect(tiers(grid)).toEqual(new Set([0]))

        await page.getByRole('button', { name: 'Bung hết tầng', exact: true }).click()
        await expect.poll(() => tiers(grid)).toEqual(new Set([0, 1]))

        await page.getByRole('button', { name: 'Gập hết tầng', exact: true }).click()
        await expect.poll(() => tiers(grid)).toEqual(new Set([0]))
    })

    it('takes the control away when the axis shrinks to one field', async () => {
        const grid = nestedGrid()
        await open(grid)
        expect(settings()?.textContent).toContain('Bung hết tầng')

        state(grid).setRows(['region'])

        await expect.poll(() => settings()?.textContent ?? '').not.toContain('Bung hết tầng')
    })

    it('still opens the field tiers when the measures run down the page', async () => {
        const grid = nestedGrid()
        await open(grid)
        state(grid).setValuesOn('rows')

        await page.getByRole('button', { name: 'Bung hết tầng', exact: true }).click()

        await expect.poll(() => tiers(grid).size).toBeGreaterThan(2)
    })

    it('reads what the grid is, so a row opened by hand flips the label', async () => {
        const grid = nestedGrid()
        await open(grid)
        expect(settings()?.textContent).toContain('Bung hết tầng')

        grid.expansion.expand(grid.preWindowNodes[0]!.id)

        await expect.poll(() => settings()?.textContent ?? '').toContain('Gập hết tầng')
    })
})
