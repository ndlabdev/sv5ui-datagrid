import {
    createDataGrid,
    defaultLabels,
    defineDataGridConfig,
    mergeLabels,
    resetDataGridConfig,
    type ColumnDef,
    type GridState
} from '$lib/index.js'
import axe from 'axe-core'
import { afterEach, describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import FilterBuilder from '../lib/components/panels/FilterBuilder.svelte'
import GroupPanel from '../lib/components/panels/GroupPanel.svelte'
import { advancedFilter } from '../lib/features/advanced-filter/advanced-filter.svelte.js'
import RangeStatusBar from '../lib/components/chrome/RangeStatusBar.svelte'
import { InGrid } from './fixtures/in-root.js'
import { grouping } from '../lib/features/grouping/grouping.svelte.js'
import {
    getRangeSelection,
    rangeSelection
} from '../lib/features/range-selection/range-selection.svelte.js'
import { deDE } from '../lib/locales/de-DE.js'
import { enUS } from '../lib/locales/en-US.js'
import { viVN } from '../lib/locales/vi-VN.js'

interface Person {
    id: number
    dept: string
    salary: number
}

const columns: ColumnDef<Person>[] = [
    { id: 'dept', header: 'Dept', width: 200 },
    { id: 'salary', header: 'Salary', width: 130 }
]

const data: Person[] = [
    { id: 1, dept: 'Core', salary: 100 },
    { id: 2, dept: 'Data', salary: 200 }
]

const de = mergeLabels(deDE.labels)
const vi = mergeLabels(viVN.labels)

const inRoot = (grid: GridState<Person>, component: unknown) => ({
    props: { grid, component }
})

function makeGrid(by: string[] = [], locale?: string): GridState<Person> {
    return createDataGrid<Person>({
        columns,
        data,
        getRowId: (row) => String(row.id),
        locales: [viVN, deDE],
        locale,
        features: [grouping({ by }), rangeSelection(), advancedFilter()]
    })
}

const ENGLISH_WORDS = [
    ...Object.values(enUS.labels ?? {}).map((label) => {
        if (typeof label !== 'function') return label
        try {
            return (label as (...args: unknown[]) => string)('X', 1, 2)
        } catch {
            return ''
        }
    })
]
    .flatMap((text) => String(text).split(/[\s\-:()|]+/))
    .filter((word) => /^[A-Za-z]{3,}$/.test(word) && word !== 'sv5ui')

describe('the chrome speaks the language its grid was given', () => {
    it('renders the group panel in Vietnamese', async () => {
        const screen = await render(InGrid, inRoot(makeGrid([], 'vi-VN'), GroupPanel))

        const panel = screen.container.querySelector('[data-dg-group-panel]')
        expect(panel?.textContent).toContain(vi.groupBy)
        expect(panel?.textContent).toContain(vi.groupPanelEmpty)
    })

    it('translates the chip aria-labels, not just the visible text', async () => {
        const screen = await render(InGrid, inRoot(makeGrid(['dept'], 'vi-VN'), GroupPanel))

        const labels = [
            ...screen.container.querySelectorAll('[data-dg-group-panel] [aria-label]')
        ].map((element) => element.getAttribute('aria-label'))

        expect(labels).toContain(vi.removeGroup('Dept'))
        expect(labels).toContain(vi.moveGroupEarlier('Dept'))
    })

    it('leaves no English word in the group panel', async () => {
        const screen = await render(InGrid, inRoot(makeGrid([], 'vi-VN'), GroupPanel))

        const text = screen.container.querySelector('[data-dg-group-panel]')?.textContent ?? ''

        const chrome = text.replace(/Dept|Salary/g, '')
        for (const word of ENGLISH_WORDS) {
            expect(chrome, `"${word}" leaked from a hardcoded label`).not.toContain(word)
        }
    })

    it('renders the filter builder in Vietnamese', async () => {
        const grid = makeGrid([], 'vi-VN')
        const screen = await render(InGrid, inRoot(grid, FilterBuilder))

        const text = screen.container.querySelector('[data-dg-filter-panel]')?.textContent ?? ''
        expect(text).toContain('Bộ lọc')

        for (const word of ENGLISH_WORDS) {
            expect(text, `"${word}" leaked from a hardcoded label`).not.toContain(word)
        }
    })

    it('renders the range status bar in Vietnamese', async () => {
        const grid = makeGrid([], 'vi-VN')
        getRangeSelection(grid)!.selectAll()
        const screen = await render(InGrid, inRoot(grid, RangeStatusBar))

        const bar = screen.container.querySelector('[data-dg-range-status]')
        expect(bar?.textContent).toContain(vi.rangeSum)
        expect(bar?.textContent).toContain('ô')
        expect(bar?.textContent).not.toContain('cells')
    })

    it('lets a single label be overridden without replacing the pack', async () => {
        const grid = createDataGrid<Person>({
            columns,
            data,
            getRowId: (row) => String(row.id),
            locales: [viVN],
            locale: 'vi-VN',
            labels: { groupBy: 'Xếp theo' },
            features: [grouping(), rangeSelection(), advancedFilter()]
        })
        const screen = await render(InGrid, inRoot(grid, GroupPanel))

        const text = screen.container.querySelector('[data-dg-group-panel]')?.textContent ?? ''
        expect(text).toContain('Xếp theo')
        expect(text).toContain(vi.groupPanelEmpty)
    })

    it('takes a pack that translates only part of the surface', async () => {
        const grid = createDataGrid<Person>({
            columns,
            data,
            getRowId: (row) => String(row.id),
            locales: [{ tag: 'de-DE', labels: { groupBy: 'Gruppieren nach' }, announcer: {} }],
            locale: 'de-DE',
            features: [grouping(), rangeSelection(), advancedFilter()]
        })
        const screen = await render(InGrid, inRoot(grid, GroupPanel))

        const text = screen.container.querySelector('[data-dg-group-panel]')?.textContent ?? ''
        expect(text).toContain('Gruppieren nach')
        expect(text).toContain(defaultLabels.groupPanelEmpty)
    })

    it('speaks German now that a German pack ships', async () => {
        const screen = await render(InGrid, inRoot(makeGrid([], 'de-DE'), GroupPanel))

        const text = screen.container.querySelector('[data-dg-group-panel]')?.textContent ?? ''
        expect(text).toContain(de.groupBy)
        expect(text).toContain(de.groupPanelEmpty)
    })

    it('falls back to English when nothing is configured', async () => {
        const screen = await render(InGrid, inRoot(makeGrid(), GroupPanel))

        const text = screen.container.querySelector('[data-dg-group-panel]')?.textContent ?? ''
        expect(text).toContain(defaultLabels.groupBy)
    })
})

describe('reading the wording from inside an effect', () => {
    it('settles instead of re-running, which is how a language picker binds', async () => {
        const grid = makeGrid([], 'vi-VN')
        let runs = 0
        let seen = ''

        const cleanup = $effect.root(() => {
            $effect(() => {
                runs++
                seen = grid.labels.groupBy
            })
        })

        await new Promise((resolve) => setTimeout(resolve, 50))
        expect(runs).toBe(1)
        expect(seen).toBe(vi.groupBy)
        cleanup()
    })
})

describe('a11y', () => {
    it('is axe-clean in Vietnamese, chips and all', async () => {
        const screen = await render(InGrid, inRoot(makeGrid(['dept']), GroupPanel))

        const results = await axe.run(screen.container, {
            rules: { region: { enabled: false }, 'page-has-heading-one': { enabled: false } }
        })
        expect(results.violations.map((violation) => violation.id)).toEqual([])
    })

    it('is axe-clean with the range status bar showing', async () => {
        const grid = makeGrid()
        getRangeSelection(grid)!.selectAll()
        const screen = await render(InGrid, inRoot(grid, RangeStatusBar))

        const results = await axe.run(screen.container, {
            rules: { region: { enabled: false }, 'page-has-heading-one': { enabled: false } }
        })
        expect(results.violations.map((violation) => violation.id)).toEqual([])
    })
})

afterEach(() => {
    resetDataGridConfig()
})

describe('the chrome takes classes from config and ui', () => {
    it('appends the configured slot classes', async () => {
        defineDataGridConfig({ slots: { groupPanel: 'border-solid' } })
        const screen = await render(InGrid, inRoot(makeGrid(), GroupPanel))

        const panel = screen.container.querySelector('[data-dg-group-panel]')
        expect(panel?.className).toContain('border-solid')
    })

    it('lets ui beat a default rather than sit next to it', async () => {
        const screen = await render(InGrid, {
            props: { grid: makeGrid(), component: GroupPanel, ui: { groupPanel: 'px-8' } }
        })

        const panel = screen.container.querySelector('[data-dg-group-panel]')
        expect(panel?.className).toContain('px-8')

        expect(panel?.className).not.toContain('px-3')
    })
})
