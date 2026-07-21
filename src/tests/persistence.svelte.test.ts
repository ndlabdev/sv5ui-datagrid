import type { Component } from 'svelte'
import { beforeEach, describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import {
    columnOps,
    createDataGrid,
    DataGrid,
    filtering,
    pagination,
    SNAPSHOT_VERSION,
    sorting,
    type ColumnDef,
    type DataGridProps,
    type GridFeature,
    type GridSnapshot,
    type GridState,
    type SortState
} from '$lib/index.js'

interface Person {
    id: number
    name: string
    email: string
    age: number
}

const TypedDataGrid = DataGrid as unknown as Component<DataGridProps<Person>>

const columns: ColumnDef<Person>[] = [
    { id: 'name', header: 'Name', sortable: true, width: 160 },
    { id: 'email', header: 'Email', width: 200 },
    { id: 'age', header: 'Age', sortable: true, width: 100 }
]

const people: Person[] = Array.from({ length: 8 }, (_, i) => ({
    id: i + 1,
    name: `Person ${i + 1}`,
    email: `user${i + 1}@example.com`,
    age: 20 + i
}))

const KEY = 'dg-test-state'

function makeGrid(extra: GridFeature<Person>[] = []): GridState<Person> {
    return createDataGrid<Person>({
        columns,
        data: people,
        getRowId: (person) => String(person.id),
        features: [sorting(), filtering(), columnOps(), pagination({ pageSize: 5 }), ...extra]
    })
}

function stored(): GridSnapshot | null {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as GridSnapshot) : null
}

async function renderGrid(grid: GridState<Person>) {
    const screen = await render(TypedDataGrid, { grid, persistState: { key: KEY } })
    await expect.element(screen.getByRole('grid')).toBeVisible()
    return screen
}

beforeEach(() => localStorage.removeItem(KEY))

describe('snapshot round-trip', () => {
    it('captures column layout, sort, filter, page size and density', () => {
        const grid = makeGrid()
        grid.columns.setWidth('name', 240)
        grid.columns.setPinned('email', 'left')
        grid.columns.setHidden('age', true)
        grid.columns.moveColumn('age', 0)
        grid.density = 'compact'
        ;(grid.api.setSort as (sort: SortState[]) => void)([
            { columnId: 'name', direction: 'desc' }
        ])
        ;(grid.api.setQuickFilter as (query: string) => void)('user3')

        const snapshot = grid.getState()
        expect(snapshot.version).toBe(SNAPSHOT_VERSION)
        expect(snapshot.columns).toMatchObject({
            widths: { name: 240 },
            pinned: { email: 'left' },
            hidden: { age: true }
        })
        // email is pinned left, so it sits ahead of name once age moves to 0.
        expect(snapshot.columns!.order).toEqual(['age', 'email', 'name'])
        expect(snapshot.density).toBe('compact')
        expect(snapshot.features).toMatchObject({
            sorting: [{ columnId: 'name', direction: 'desc' }],
            filtering: { quick: 'user3' },
            pagination: 5
        })
        expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot)
    })

    it('restores onto a fresh grid', () => {
        const source = makeGrid()
        source.columns.setWidth('name', 240)
        source.columns.setHidden('age', true)
        source.density = 'comfortable'
        ;(source.api.setSort as (sort: SortState[]) => void)([
            { columnId: 'age', direction: 'desc' }
        ])

        const target = makeGrid()
        target.setState(source.getState())

        expect(target.columns.widthOf('name')).toBe(240)
        expect(target.columns.visible.map((column) => column.id)).toEqual(['name', 'email'])
        expect(target.density).toBe('comfortable')
        // The restored sort must actually drive the pipeline, not just sit in state.
        expect(target.nodes[0].row.id).toBe(8)
    })

    it('omits untouched sections so the snapshot stays small', () => {
        expect(makeGrid().getState()).toEqual({
            version: SNAPSHOT_VERSION,
            features: { pagination: 5 }
        })
    })
})

describe('persistState', () => {
    it('writes the snapshot to localStorage as the user rearranges', async () => {
        const grid = makeGrid()
        await renderGrid(grid)

        grid.columns.setWidth('name', 240)
        await expect.poll(() => stored()?.columns?.widths).toEqual({ name: 240 })
    })

    it('restores a stored snapshot on mount', async () => {
        localStorage.setItem(
            KEY,
            JSON.stringify({
                version: SNAPSHOT_VERSION,
                columns: { hidden: { email: true }, widths: { name: 240 } },
                density: 'compact'
            })
        )

        const grid = makeGrid()
        await renderGrid(grid)

        await expect
            .poll(() => grid.columns.visible.map((column) => column.id))
            .toEqual(['name', 'age'])
        expect(grid.columns.widthOf('name')).toBe(240)
        expect(grid.density).toBe('compact')
    })

    it('ignores a corrupt entry instead of breaking the grid', async () => {
        localStorage.setItem(KEY, '{ not json')
        const grid = makeGrid()
        const screen = await renderGrid(grid)

        await expect.element(screen.getByRole('grid')).toBeVisible()
        expect(grid.columns.visible).toHaveLength(3)
    })

    it('discards a snapshot from an older version', async () => {
        localStorage.setItem(
            KEY,
            JSON.stringify({ version: 0, columns: { hidden: { email: true } } })
        )
        const grid = makeGrid()
        await renderGrid(grid)

        expect(grid.columns.visible).toHaveLength(3)
    })

    it('upgrades an older snapshot through migrate', async () => {
        localStorage.setItem(KEY, JSON.stringify({ version: 0, oldDensity: 'compact' }))

        const grid = makeGrid()
        const screen = await render(TypedDataGrid, {
            grid,
            persistState: {
                key: KEY,
                migrate: (old: GridSnapshot & { oldDensity?: string }) => ({
                    version: SNAPSHOT_VERSION,
                    density: old.oldDensity as GridSnapshot['density']
                })
            }
        })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        await expect.poll(() => grid.density).toBe('compact')
    })

    it('does not resurrect a column the app no longer defines', async () => {
        localStorage.setItem(
            KEY,
            JSON.stringify({
                version: SNAPSHOT_VERSION,
                columns: { order: ['removed', 'age', 'name', 'email'], widths: { removed: 500 } }
            })
        )

        const grid = makeGrid()
        await renderGrid(grid)

        await expect
            .poll(() => grid.columns.all.map((column) => column.id))
            .toEqual(['age', 'name', 'email'])
    })
})

describe('feature slices', () => {
    it('lets a feature persist its own state without the kernel knowing it', async () => {
        let hydrated: unknown = null
        const custom: GridFeature<Person> = {
            id: 'demo-feature',
            serialize: () => ({ mode: 'wide' }),
            hydrate: (slice) => {
                hydrated = slice
            }
        }

        const grid = makeGrid([custom])
        expect(grid.getState().features).toMatchObject({ 'demo-feature': { mode: 'wide' } })

        const target = makeGrid([custom])
        target.setState(grid.getState())
        expect(hydrated).toEqual({ mode: 'wide' })
    })

    it('skips hydrate for a feature the snapshot knows nothing about', () => {
        let called = false
        const custom: GridFeature<Person> = {
            id: 'added-later',
            hydrate: () => {
                called = true
            }
        }

        makeGrid([custom]).setState({ version: SNAPSHOT_VERSION })
        expect(called).toBe(false)
    })
})
