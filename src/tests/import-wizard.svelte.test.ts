import { createDataGrid, filtering, sorting, type ColumnDef, type GridState } from '$lib/index.js'
import axe from 'axe-core'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { page } from 'vitest/browser'
import ImportWizard from '../lib/components/panels/ImportWizard.svelte'
import { InGrid } from './fixtures/in-root.js'
import { dataImport, getDataImport } from '../lib/features/data-import/data-import.svelte.js'
import { viVN } from '../lib/locales/vi-VN.js'

interface Member {
    id: number
    name: string
    email: string
    qty: number
}

const columns: ColumnDef<Member>[] = [
    { id: 'name', header: 'Name' },
    {
        id: 'email',
        header: 'Email',
        validate: (value) => (String(value ?? '').includes('@') ? null : 'Email needs an @')
    },
    { id: 'qty', header: 'Qty', type: 'number' }
]

const FILE = 'Name,Email,Qty\nChi,chi@x.vn,3\nAn,broken,abc\n'

// The wizard takes its grid from context, so it is mounted inside one.
const TypedWizard = InGrid

const inRoot = (grid: GridState<Member>) => ({ props: { grid, component: ImportWizard } })

function makeGrid(
    onCommit: (rows: Member[]) => void = () => {},
    locale?: string
): GridState<Member> {
    return createDataGrid<Member>({
        columns,
        data: [],
        getRowId: (row) => String(row.id),
        locales: [viVN],
        locale,
        features: [
            sorting(),
            filtering(),
            dataImport<Member>({ onCommit, newRow: (index) => ({ id: index + 1 }) })
        ]
    })
}

describe('the wizard walks a file in', () => {
    it('starts on the drop step and offers a paste', async () => {
        const grid = makeGrid()
        const screen = await render(TypedWizard, inRoot(grid))

        const panel = screen.container.querySelector('[data-dg-import]')
        expect(panel?.getAttribute('data-dg-import')).toBe('idle')
        expect(panel?.textContent).toContain('Paste')
    })

    it('moves to matching once a file is taken, and guesses the columns', async () => {
        const grid = makeGrid()
        const screen = await render(TypedWizard, inRoot(grid))
        const importing = getDataImport(grid)!

        await importing.takeText(FILE)
        await vi.waitFor(() =>
            expect(
                screen.container.querySelector('[data-dg-import]')?.getAttribute('data-dg-import')
            ).toBe('mapping')
        )

        expect(importing.mappings.map((entry) => entry.sourceIndex)).toEqual([0, 1, 2])
        expect(screen.container.textContent).toContain('chi@x.vn')
    })

    it('counts what needs attention on the review step', async () => {
        const grid = makeGrid()
        const screen = await render(TypedWizard, inRoot(grid))
        const importing = getDataImport(grid)!

        await importing.takeText(FILE)
        await importing.review()

        await vi.waitFor(() => expect(screen.container.textContent).toContain('To check: 1'))
        expect(screen.container.textContent).toContain('Email needs an @')
        expect(screen.container.textContent).toContain('Add all (2)')
    })

    it('hands the ready rows over when that button is pressed', async () => {
        const handed: Member[][] = []
        const grid = makeGrid((rows) => handed.push(rows))
        await render(TypedWizard, inRoot(grid))
        const importing = getDataImport(grid)!

        await importing.takeText(FILE)
        await importing.review()

        await page.getByRole('button', { name: 'Add ready (1)' }).click()
        await vi.waitFor(() => expect(handed).toHaveLength(1))
        expect(handed[0]!.map((row) => row.name)).toEqual(['Chi'])
    })

    it('says what it could not read rather than failing quietly', async () => {
        const grid = makeGrid()
        const screen = await render(TypedWizard, inRoot(grid))
        const importing = getDataImport(grid)!

        await importing.take(new File(['x'], 'report.pdf'))
        await vi.waitFor(() => expect(screen.container.textContent).toContain('report.pdf'))
    })
})

describe('a file that repeats what is already there', () => {
    const REPEATS = 'Name,Email,Qty\nChi,chi@x.vn,3\nHa,ha@x.vn,4\nHa again,HA@X.vn,5\n'

    function dedupeGrid(existing: Member[]): GridState<Member> {
        return createDataGrid<Member>({
            columns,
            data: existing,
            getRowId: (row) => String(row.id),
            features: [
                sorting(),
                filtering(),
                dataImport<Member>({
                    onCommit: () => {},
                    newRow: (index) => ({ id: 100 + index }),
                    dedupe: { columns: ['email'], against: 'both' }
                })
            ]
        })
    }

    it('names the row the grid already holds and the one the file repeats', async () => {
        const grid = dedupeGrid([{ id: 1, name: 'Chi', email: 'chi@x.vn', qty: 3 }])
        const screen = await render(TypedWizard, inRoot(grid))
        const importing = getDataImport(grid)!

        await importing.takeText(REPEATS)
        await importing.review()

        await vi.waitFor(() => expect(screen.container.textContent).toContain('To check: 2'))
        expect(screen.container.textContent).toContain('chi@x.vn is already in this grid')
        expect(screen.container.textContent).toContain('HA@X.vn is in this file more than once')
        expect(screen.container.textContent).toContain('Add ready (1)')
    })

    it('leaves the file alone when no key was declared', async () => {
        const grid = makeGrid()
        const screen = await render(TypedWizard, inRoot(grid))
        const importing = getDataImport(grid)!

        await importing.takeText(REPEATS)
        await importing.review()

        await vi.waitFor(() => expect(screen.container.textContent).toContain('Add all (3)'))
        expect(screen.container.textContent).not.toContain('more than once')
    })
})

describe('a file whose columns match nothing', () => {
    it('says so, refuses to move on, and leaves every column pickable', async () => {
        const grid = makeGrid()
        const screen = await render(TypedWizard, inRoot(grid))
        const importing = getDataImport(grid)!

        await importing.takeText('Alpha,Beta\n1,two\n3,four\n')
        await vi.waitFor(() => expect(importing.step).toBe('mapping'))

        expect(screen.container.textContent).toContain('Nothing matched')
        expect(importing.matchedCount).toBe(0)
        expect(importing.canReview).toBe(false)

        expect(screen.container.textContent).toContain('Alpha')
        expect(screen.container.textContent).toContain('two')
    })

    it('counts the ones it did match rather than staying silent', async () => {
        const grid = makeGrid()
        const screen = await render(TypedWizard, inRoot(grid))
        const importing = getDataImport(grid)!

        await importing.takeText('Email,Beta\nchi@x.vn,two\n')
        await vi.waitFor(() => expect(importing.step).toBe('mapping'))

        expect(importing.matchedCount).toBe(1)
        expect(screen.container.textContent).toContain('1 of 3 columns matched')
    })

    it('goes on once the user maps one by hand', async () => {
        const grid = makeGrid()
        await render(TypedWizard, inRoot(grid))
        const importing = getDataImport(grid)!

        await importing.takeText('Alpha,Beta\nChi,two\n')
        importing.setMapping('name', 0)

        expect(importing.canReview).toBe(true)
        await importing.review()
        expect(importing.staged.map((row) => row.name)).toEqual(['Chi'])
    })
})

describe('the wizard in another language', () => {
    it('speaks the configured one', async () => {
        const grid = makeGrid(() => {}, 'vi-VN')
        const screen = await render(TypedWizard, inRoot(grid))

        expect(screen.container.textContent).toContain('Dán')
    })
})

describe('a11y', () => {
    it('is axe-clean on every step', async () => {
        const grid = makeGrid()
        const screen = await render(TypedWizard, inRoot(grid))
        const importing = getDataImport(grid)!

        const clean = async () => {
            const results = await axe.run(screen.container, {
                rules: { region: { enabled: false }, 'page-has-heading-one': { enabled: false } }
            })
            return results.violations.map((violation) => violation.id)
        }

        expect(await clean()).toEqual([])

        await importing.takeText(FILE)
        await vi.waitFor(() => expect(importing.step).toBe('mapping'))
        expect(await clean()).toEqual([])

        await importing.review()
        await vi.waitFor(() => expect(importing.step).toBe('review'))
        expect(await clean()).toEqual([])
    })
})
