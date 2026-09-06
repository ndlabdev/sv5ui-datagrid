import {
    createDataGrid,
    sorting,
    virtualization,
    type ColumnDef,
    type GridState
} from '$lib/index.js'
import axe from 'axe-core'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { userEvent } from 'vitest/browser'
import ConditionalFormattingPanel from '../lib/components/panels/ConditionalFormattingPanel.svelte'
import { defaultLabels, mergeLabels } from '$lib/index.js'
import { conditionalFormatting } from '../lib/features/conditional-formatting/conditional-formatting.svelte.js'
import { formula } from '../lib/features/formula/formula.svelte.js'
import type { FormatRule } from '../lib/features/conditional-formatting/conditional-formatting.types.js'
import { serverRowModel } from '../lib/features/server-row-model/server-row-model.svelte.js'
import type { DataSource } from '../lib/features/server-row-model/server-row-model.types.js'
import { viVN } from '../lib/locales/vi-VN.js'
import { InGrid } from './in-root.js'

interface Deal {
    id: number
    owner: string
    status: string
    amount: number
}

const columns: ColumnDef<Deal>[] = [
    { id: 'owner', header: 'Owner', width: 140 },
    { id: 'status', header: 'Status', width: 140 },
    { id: 'amount', header: 'Amount', width: 120 }
]

const deals: Deal[] = [
    { id: 1, owner: 'Ann', status: 'open', amount: 100 },
    { id: 2, owner: 'Bob', status: 'overdue', amount: 400 }
]

// The panel takes its grid from context, so it is mounted inside one.
const TypedPanel = InGrid

const inRoot = (grid: GridState<Deal>) => ({
    props: { grid, component: ConditionalFormattingPanel }
})

function makeGrid(rules: FormatRule[] = [], locale?: string): GridState<Deal> {
    return createDataGrid<Deal>({
        columns,
        data: deals,
        getRowId: (deal) => String(deal.id),
        locales: [viVN],
        locale,
        features: [sorting(), conditionalFormatting<Deal>({ rules })]
    })
}

// A pack answers only for what it overrides, so English fills the rest in.
// The panel reads a complete table; a test comparing against one should too.
const vi = mergeLabels(viVN.labels)

const panelOf = (container: Element) => container.querySelector('[data-dg-format-panel]')!

// `serverRowModel()` contributes its own component, so a root is enough.
const TypedRoot = InGrid

async function offeredColumns(container: Element): Promise<string[]> {
    const trigger = [...container.querySelectorAll('button[aria-label]')].find(
        (button) => button.getAttribute('aria-label') === defaultLabels.formatColumn
    )!
    await userEvent.click(trigger as HTMLElement)
    const items = [...document.querySelectorAll('[role="option"]')].map(
        (option) => option.textContent?.trim() ?? ''
    )
    await userEvent.keyboard('{Escape}')
    return items
}

describe('the rule panel builds rules the app never wrote', () => {
    it('says so when a grid carries no rules', async () => {
        const screen = await render(TypedPanel, inRoot(makeGrid()))
        expect(panelOf(screen.container).textContent).toContain(defaultLabels.formatEmpty)
    })

    it('names each rule by its kind and the column it paints', async () => {
        const grid = makeGrid([
            { kind: 'colorScale', column: 'amount' },
            { kind: 'expression', when: 'amount > 1' }
        ])
        const screen = await render(TypedPanel, inRoot(grid))
        const text = panelOf(screen.container).textContent ?? ''

        expect(text).toContain(
            defaultLabels.formatRuleName(defaultLabels.formatKindColorScale, 'Amount')
        )
        expect(text).toContain(
            defaultLabels.formatRuleName(
                defaultLabels.formatKindExpression,
                defaultLabels.formatWholeRow
            )
        )
    })

    it('adds the rule the form is showing, against the first column it can read', async () => {
        const grid = makeGrid()
        const screen = await render(TypedPanel, inRoot(grid))

        await userEvent.click(
            screen.getByRole('button', { name: defaultLabels.formatAdd }).element() as HTMLElement
        )

        expect(grid.api.getFormatRules?.()).toEqual([
            expect.objectContaining({ kind: 'colorScale', column: 'amount' })
        ])
        expect(panelOf(screen.container).textContent).toContain(
            defaultLabels.formatRuleName(defaultLabels.formatKindColorScale, 'Amount')
        )
    })

    it('offers a colour scale only the columns it can read', async () => {
        const grid = makeGrid()
        const screen = await render(TypedPanel, inRoot(grid))

        const picker = screen.container.querySelectorAll('button[aria-label]')
        const columnPicker = [...picker].find(
            (button) => button.getAttribute('aria-label') === defaultLabels.formatColumn
        )!
        await userEvent.click(columnPicker as HTMLElement)

        const offered = [...document.querySelectorAll('[role="option"]')].map(
            (option) => option.textContent?.trim() ?? ''
        )
        expect(offered).toContain('Amount')
        expect(offered).not.toContain('Owner')
        expect(offered).not.toContain('Status')
    })

    it('removes the rule the chip names, and only that one', async () => {
        const grid = makeGrid([
            { kind: 'colorScale', column: 'amount', id: 'scale' },
            { kind: 'duplicates', column: 'owner', id: 'dupes' }
        ])
        const screen = await render(TypedPanel, inRoot(grid))

        const name = defaultLabels.formatRuleName(defaultLabels.formatKindColorScale, 'Amount')
        const remove = screen.container.querySelector<HTMLElement>(
            `[aria-label="${defaultLabels.formatRemoveRule(name)}"]`
        )!
        await userEvent.click(remove)

        expect(grid.api.getFormatRules?.().map((rule) => rule.id)).toEqual(['dupes'])
    })

    it('clears every rule at once', async () => {
        const grid = makeGrid([{ kind: 'dataBar', column: 'amount' }])
        const screen = await render(TypedPanel, inRoot(grid))

        await userEvent.click(
            screen.getByRole('button', { name: defaultLabels.formatClear }).element() as HTMLElement
        )

        expect(grid.api.getFormatRules?.()).toHaveLength(0)
    })

    it('shows why an expression will not parse, next to the rule that will not', async () => {
        const grid = makeGrid([{ kind: 'expression', when: 'status =' }])
        const screen = await render(TypedPanel, inRoot(grid))

        const live = panelOf(screen.container).querySelector('[aria-live="polite"]')
        expect(live?.textContent).toContain('Will not parse')
    })
})

describe('the picker under a grid that cannot answer yet', () => {
    it('offers every column while there is no row to read', async () => {
        const grid = createDataGrid<Deal>({
            columns,
            data: [],
            getRowId: (deal) => String(deal.id),
            features: [conditionalFormatting<Deal>({})]
        })
        const screen = await render(TypedPanel, inRoot(grid))

        expect(await offeredColumns(screen.container)).toEqual(['Owner', 'Status', 'Amount'])
    })

    it('narrows to the numeric columns once a server model has loaded a page', async () => {
        let release = () => {}
        const held = new Promise<void>((resolve) => {
            release = resolve
        })
        const source: DataSource<Deal> = {
            async getRows(request) {
                await held
                const rows: Deal[] = []
                for (let i = request.startRow; i < Math.min(request.endRow, 40); i++) {
                    rows.push({
                        id: i + 1,
                        owner: `Owner ${i}`,
                        status: 'open',
                        amount: (i + 1) * 10
                    })
                }
                return { rows, rowCount: 40 }
            }
        }
        const grid = createDataGrid<Deal>({
            columns,
            data: [],
            getRowId: (deal) => String(deal.id),
            rowModel: 'server',
            features: [
                sorting(),
                virtualization({ rowHeight: 40 }),
                serverRowModel<Deal>(source, {
                    mode: 'infinite',
                    blockSize: 20,
                    placeholder: (index) => ({ id: -(index + 1) }) as Deal
                }),
                conditionalFormatting<Deal>({})
            ]
        })
        await render(TypedRoot, { props: { grid } })
        const screen = await render(TypedPanel, inRoot(grid))

        expect(await offeredColumns(screen.container)).toEqual(['Owner', 'Status', 'Amount'])

        release()
        await expect.poll(() => grid.data.length).toBeGreaterThan(0)
        expect(await offeredColumns(screen.container)).toEqual(['Amount'])
    })

    it('offers a formula column, whose numbers exist only after the pipeline ran', async () => {
        interface Line extends Deal {
            total?: number
        }
        const grid = createDataGrid<Line>({
            columns: [...columns, { id: 'total', header: 'Total', width: 120 }],
            data: deals,
            getRowId: (deal) => String(deal.id),
            features: [
                formula<Line>({ columns: { total: 'amount * 2' } }),
                conditionalFormatting<Line>({})
            ]
        })
        const screen = await render(TypedPanel, {
            props: { grid, component: ConditionalFormattingPanel }
        })

        expect(await offeredColumns(screen.container)).toEqual(['Amount', 'Total'])
    })

    it('drops a column the switched kind cannot read rather than building on it', async () => {
        const grid = makeGrid()
        const screen = await render(TypedPanel, inRoot(grid))

        const kindTrigger = [...screen.container.querySelectorAll('button[aria-label]')].find(
            (button) => button.getAttribute('aria-label') === defaultLabels.formatKind
        )!
        await userEvent.click(kindTrigger as HTMLElement)
        await userEvent.click(
            [...document.querySelectorAll('[role="option"]')].find((option) =>
                option.textContent?.includes(defaultLabels.formatKindDuplicates)
            ) as HTMLElement
        )

        const columnTrigger = [...screen.container.querySelectorAll('button[aria-label]')].find(
            (button) => button.getAttribute('aria-label') === defaultLabels.formatColumn
        )!
        await userEvent.click(columnTrigger as HTMLElement)
        await userEvent.click(
            [...document.querySelectorAll('[role="option"]')].find((option) =>
                option.textContent?.includes('Owner')
            ) as HTMLElement
        )

        await userEvent.click(kindTrigger as HTMLElement)
        await userEvent.click(
            [...document.querySelectorAll('[role="option"]')].find((option) =>
                option.textContent?.includes(defaultLabels.formatKindColorScale)
            ) as HTMLElement
        )
        await userEvent.click(
            screen.getByRole('button', { name: defaultLabels.formatAdd }).element() as HTMLElement
        )

        expect(grid.api.getFormatRules?.()).toEqual([
            expect.objectContaining({ kind: 'colorScale', column: 'amount' })
        ])
    })
})

describe('the panel speaks the configured language', () => {
    it('renders in Vietnamese, aria-labels included', async () => {
        const grid = makeGrid([{ kind: 'topN', column: 'amount' }], 'vi-VN')
        const screen = await render(TypedPanel, inRoot(grid))

        const panel = panelOf(screen.container)
        expect(panel.textContent).toContain(vi.formatLabel)
        expect(panel.textContent).toContain(vi.formatKindTopN)

        const name = vi.formatRuleName(vi.formatKindTopN, 'Amount')
        expect(panel.querySelector(`[aria-label="${vi.formatRemoveRule(name)}"]`)).not.toBeNull()
    })

    it('leaves no English word behind in the panel chrome', async () => {
        const screen = await render(TypedPanel, inRoot(makeGrid([], 'vi-VN')))

        const text = (panelOf(screen.container).textContent ?? '').replace(
            /Owner|Status|Amount/g,
            ''
        )
        // The table is the whole grid's now, not one feature's, so the
        // functions in it take anything from one argument to three. Feed each
        // enough and ignore the ones that want a shape rather than a value.
        const english = Object.values(defaultLabels)
            .map((label) => {
                if (typeof label !== 'function') return label
                try {
                    return (label as (...args: unknown[]) => string)('X', 1, 2)
                } catch {
                    return ''
                }
            })
            .flatMap((value) => String(value).split(/[\s\-:()|"=]+/))
            .filter((word) => /^[A-Za-z]{3,}$/.test(word) && word !== 'sv5ui')

        for (const word of english) {
            expect(text, `"${word}" leaked from a hardcoded label`).not.toContain(word)
        }
    })
})

describe('accessibility', () => {
    it('is axe-clean with rules on the panel', async () => {
        const screen = await render(TypedPanel, {
            grid: makeGrid([{ kind: 'colorScale', column: 'amount' }])
        })

        const results = await axe.run(screen.container, {
            rules: { region: { enabled: false }, 'page-has-heading-one': { enabled: false } }
        })
        expect(results.violations.map((violation) => violation.id)).toEqual([])
    })
})
