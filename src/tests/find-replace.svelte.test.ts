import {
    createDataGrid,
    editing,
    filtering,
    sorting,
    type ColumnDef,
    type DataGridProps,
    type GridState
} from '$lib/index.js'
import axe from 'axe-core'
import type { Component } from 'svelte'
import InRoot from './InRoot.svelte'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { userEvent } from 'vitest/browser'
import FindReplace from '../lib/components/panels/FindReplace.svelte'
import DataGrid from '../lib/components/grid/DataGrid.svelte'
import { findReplace, getFindReplace } from '../lib/features/find-replace/find-replace.svelte.js'
import type { FindReplaceOptions } from '../lib/features/find-replace/find-replace.types.js'

interface Row {
    id: number
    dept: string
    name: string
    city: string
}

const columns: ColumnDef<Row>[] = [
    { id: 'dept', header: 'Dept', width: 120 },
    { id: 'name', header: 'Name', width: 160, editable: true },
    { id: 'city', header: 'City', width: 160, editable: true }
]

const TypedGrid = DataGrid as unknown as Component<DataGridProps<Row>>
// The part takes its grid from context, so it is mounted inside one.
const TypedPanel = InRoot as unknown as Component<Record<string, unknown>>

const inRoot = (grid: GridState<Row>) => ({ props: { grid, component: FindReplace } })

function makeGrid(options: FindReplaceOptions = {}): GridState<Row> {
    return createDataGrid<Row>({
        columns,
        data: [
            { id: 1, dept: 'Core', name: 'Anna', city: 'Hà Nội' },
            { id: 2, dept: 'Data', name: 'Bình', city: 'Hà Nam' },
            { id: 3, dept: 'Core', name: 'Chi', city: 'Huế' }
        ],
        getRowId: (row) => String(row.id),
        features: [sorting(), filtering(), editing(), findReplace(options)]
    })
}

async function mount(grid: GridState<Row>) {
    const screen = await render(TypedPanel, inRoot(grid))
    await render(TypedGrid, { grid })
    return screen
}

describe('the hotkeys reach the grid from anywhere on the page', () => {
    it('opens on Ctrl+F without the grid ever being focused', async () => {
        const grid = makeGrid()
        await mount(grid)
        expect(document.activeElement).toBe(document.body)

        await userEvent.keyboard('{Control>}f{/Control}')
        await expect.poll(() => getFindReplace(grid)!.open).toBe(true)
    })

    it('opens on the Meta variant too, which is the one a Mac sends', async () => {
        const grid = makeGrid()
        await mount(grid)

        await userEvent.keyboard('{Meta>}f{/Meta}')
        await expect.poll(() => getFindReplace(grid)!.open).toBe(true)
    })

    it('puts the caret in the search box, so typing starts a search', async () => {
        const grid = makeGrid()
        const screen = await mount(grid)

        await userEvent.keyboard('{Control>}f{/Control}')
        await expect.poll(() => getFindReplace(grid)!.open).toBe(true)

        const box = screen.container.querySelector('[data-dg-find] input')
        await expect.poll(() => document.activeElement).toBe(box)
    })

    it('Ctrl+H lands in the replace box', async () => {
        const grid = makeGrid()
        const screen = await mount(grid)

        await userEvent.keyboard('{Control>}h{/Control}')
        await expect.poll(() => getFindReplace(grid)!.open).toBe(true)

        const inputs = screen.container.querySelectorAll('[data-dg-find] input')
        await expect.poll(() => document.activeElement).toBe(inputs[1])
    })

    it('leaves the keys alone when hotkeys are off', async () => {
        const grid = makeGrid({ hotkeys: false })
        await mount(grid)

        await userEvent.keyboard('{Control>}f{/Control}')
        expect(getFindReplace(grid)!.open).toBe(false)
    })
})

describe('the panel', () => {
    it('steps with Enter and closes with Escape', async () => {
        const grid = makeGrid()
        const screen = await mount(grid)
        await userEvent.keyboard('{Control>}f{/Control}')
        await expect.poll(() => getFindReplace(grid)!.open).toBe(true)

        await userEvent.keyboard('Hà')
        await expect.poll(() => getFindReplace(grid)!.total).toBe(2)

        await userEvent.keyboard('{Enter}')
        await expect.poll(() => getFindReplace(grid)!.current).toBe(0)
        await userEvent.keyboard('{Enter}')
        await expect.poll(() => getFindReplace(grid)!.current).toBe(1)

        await userEvent.keyboard('{Enter}')
        await expect.poll(() => getFindReplace(grid)!.current).toBe(0)

        await userEvent.keyboard('{Escape}')
        await expect.poll(() => getFindReplace(grid)!.open).toBe(false)
        expect(screen.container.querySelector('[data-dg-find]')).toBeNull()
    })

    it('greys out Replace and says why when nothing found is writable', async () => {
        const grid = makeGrid()
        const screen = await mount(grid)
        const state = getFindReplace(grid)!
        state.show()
        state.query = 'Data'
        state.step(1)

        const replaceButtons = () =>
            [...screen.container.querySelectorAll('[data-dg-find] button')].filter((button) =>
                /Replace/.test(button.textContent ?? '')
            )

        await expect.poll(() => replaceButtons().length).toBe(2)
        expect(replaceButtons().every((button) => button.hasAttribute('disabled'))).toBe(true)

        await expect
            .poll(() =>
                screen.container.querySelector('[data-dg-find] [aria-live]')?.textContent?.trim()
            )
            .toBe('1 found, none editable')
    })

    it('says how many cells a replace wrote', async () => {
        const grid = makeGrid()
        const screen = await mount(grid)
        const state = getFindReplace(grid)!
        state.show()
        state.query = 'Hà'
        state.replacement = 'Ha'
        state.replaceAll()

        await expect
            .poll(() =>
                screen.container.querySelector('[data-dg-find] [aria-live]')?.textContent?.trim()
            )
            .toBe('Replaced 2')
    })

    it('is axe-clean with matches on screen', async () => {
        const grid = makeGrid()
        const screen = await mount(grid)
        const state = getFindReplace(grid)!
        state.show()
        state.query = 'Hà'
        state.step(1)

        const results = await axe.run(screen.container, {
            rules: { region: { enabled: false }, 'page-has-heading-one': { enabled: false } }
        })
        expect(results.violations.map((violation) => violation.id)).toEqual([])
    })
})
