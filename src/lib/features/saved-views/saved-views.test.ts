import { createDataGrid, type GridState } from '../../core/grid/index.js'
import { type ColumnDef } from '../../core/types/index.js'
import { filtering } from '../../features/filtering/index.js'
import { sorting } from '../../features/sorting/index.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getGrouping, grouping } from '../grouping/index.js'
import { getSavedViews, savedViews } from './saved-views.svelte.js'
import { SHARE_PARAM } from './share-param.js'
import type { SavedView, SavedViewsOptions, SavedViewStorage } from './saved-views.types.js'
import { mergeViews, parseViews } from './storage.js'

interface Row {
    id: number
    dept: string
    country: string
    salary: number
}

const columns: ColumnDef<Row>[] = [
    { id: 'dept', header: 'Dept', sortable: true, filter: 'text' },
    { id: 'country', header: 'Country', sortable: true },
    { id: 'salary', header: 'Salary', sortable: true }
]

const data: Row[] = [
    { id: 1, dept: 'Core', country: 'VN', salary: 100 },
    { id: 2, dept: 'Core', country: 'US', salary: 200 },
    { id: 3, dept: 'Data', country: 'VN', salary: 300 }
]

function memoryStorage(): SavedViewStorage & { saved: SavedView[] | null } {
    return {
        saved: null,
        read() {
            return this.saved
        },
        write(_key, views) {
            this.saved = views
        }
    }
}

function makeGrid(options: SavedViewsOptions = { storage: null }): GridState<Row> {
    return createDataGrid<Row>({
        columns,
        data,
        getRowId: (row) => String(row.id),
        features: [sorting(), filtering(), grouping<Row>(), savedViews<Row>(options)]
    })
}

describe('saving and applying', () => {
    it('captures the grouping, which is the whole reason to save a view', () => {
        const grid = makeGrid()
        const views = getSavedViews(grid)!
        getGrouping(grid)!.setGroupBy(['dept'])

        const view = views.save('By dept')!
        expect(view.snapshot.features?.grouping).toEqual({ by: ['dept'] })

        getGrouping(grid)!.clearGrouping()
        expect(getGrouping(grid)!.by).toEqual([])

        views.apply(view.id)
        expect(getGrouping(grid)!.by).toEqual(['dept'])
    })

    it('captures the sort and the column layout with it', () => {
        const grid = makeGrid()
        const views = getSavedViews(grid)!
        ;(grid.api.setSort as (sort: unknown[]) => void)([
            { columnId: 'salary', direction: 'desc' }
        ])
        grid.columns.setHidden('country', true)

        const view = views.save('Salary first')!
        grid.columns.setHidden('country', false)
        ;(grid.api.setSort as (sort: unknown[]) => void)([])

        views.apply(view.id)
        expect(grid.columns.get('country')?.hidden).toBe(true)
        expect(view.snapshot.features?.sorting).toBeDefined()
    })

    it('refuses a blank name rather than making a view nobody can pick out', () => {
        const views = getSavedViews(makeGrid())!
        expect(views.save('   ')).toBeNull()
        expect(views.views).toEqual([])
    })

    it('reports a miss instead of throwing on an id it does not have', () => {
        const views = getSavedViews(makeGrid())!
        expect(views.apply('nope')).toBe(false)
        expect(views.remove('nope')).toBe(false)
        expect(views.update('nope')).toBe(false)
        expect(views.rename('nope', 'x')).toBe(false)
    })
})

describe('the modified flag', () => {
    it('is null with no view active, which is not the same as unchanged', () => {
        expect(getSavedViews(makeGrid())!.modified).toBeNull()
    })

    it('turns on when the grid moves off the view, and off again on revert', () => {
        const grid = makeGrid()
        const views = getSavedViews(grid)!
        getGrouping(grid)!.setGroupBy(['dept'])
        views.save('By dept')

        expect(views.modified).toBe(false)
        getGrouping(grid)!.setGroupBy(['country'])
        expect(views.modified).toBe(true)

        views.revert()
        expect(views.modified).toBe(false)
        expect(getGrouping(grid)!.by).toEqual(['dept'])
    })

    it('does not flicker when the same state is rebuilt in another order', () => {
        const grid = makeGrid()
        const views = getSavedViews(grid)!
        getGrouping(grid)!.setGroupBy(['dept', 'country'])
        views.save('Two levels')

        getGrouping(grid)!.clearGrouping()
        getGrouping(grid)!.setGroupBy(['dept', 'country'])
        expect(views.modified).toBe(false)
    })

    it('clears once the view is updated to match', () => {
        const grid = makeGrid()
        const views = getSavedViews(grid)!
        const view = views.save('Start')!
        getGrouping(grid)!.setGroupBy(['dept'])
        expect(views.modified).toBe(true)

        views.update(view.id)
        expect(views.modified).toBe(false)
    })
})

describe('renaming and removing', () => {
    it('keeps the id across a rename, so a share link still resolves', () => {
        const views = getSavedViews(makeGrid())!
        const view = views.save('Old')!
        views.rename(view.id, 'New')

        expect(views.views[0]).toMatchObject({ id: view.id, name: 'New' })
    })

    it('refuses a blank rename', () => {
        const views = getSavedViews(makeGrid())!
        const view = views.save('Keep')!
        expect(views.rename(view.id, '  ')).toBe(false)
        expect(views.views[0]!.name).toBe('Keep')
    })

    it('stands on nothing after removing the active view', () => {
        const views = getSavedViews(makeGrid())!
        const view = views.save('Gone')!
        views.remove(view.id)

        expect(views.activeId).toBeNull()
        expect(views.active).toBeNull()
        expect(views.modified).toBeNull()
    })
})

describe('persistence', () => {
    it('writes on every change and reads back on the next grid', () => {
        const storage = memoryStorage()
        const first = getSavedViews(makeGrid({ storage }))!
        first.save('Kept')

        expect(storage.saved).toHaveLength(1)
        expect(getSavedViews(makeGrid({ storage }))!.views[0]?.name).toBe('Kept')
    })

    it('keeps seeded views a user has never touched', () => {
        const seeded: SavedView[] = [{ id: 'built-in', name: 'Default', snapshot: { version: 1 } }]
        const storage = memoryStorage()
        storage.saved = [{ id: 'mine', name: 'Mine', snapshot: { version: 1 } }]

        const views = getSavedViews(makeGrid({ views: seeded, storage }))!
        expect(views.views.map((view) => view.id)).toEqual(['built-in', 'mine'])
    })

    it('lets a stored view win over a seeded one with the same id', () => {
        const seeded: SavedView[] = [{ id: 'shared', name: 'Shipped', snapshot: { version: 1 } }]
        const storage = memoryStorage()
        storage.saved = [{ id: 'shared', name: 'Edited', snapshot: { version: 1 } }]

        expect(getSavedViews(makeGrid({ views: seeded, storage }))!.views[0]!.name).toBe('Edited')
    })

    it('keeps everything in memory when storage is off', () => {
        const views = getSavedViews(makeGrid({ storage: null }))!
        views.save('Session only')
        expect(views.views).toHaveLength(1)
    })

    it('tells an app about every change, for one persisting the list itself', () => {
        const onChange = vi.fn()
        const views = getSavedViews(makeGrid({ storage: null, onChange }))!
        const view = views.save('One')!
        views.rename(view.id, 'Two')
        views.remove(view.id)

        expect(onChange).toHaveBeenCalledTimes(3)
        expect(onChange).toHaveBeenLastCalledWith([])
    })
})

describe('reading a stored list', () => {
    it('reads nothing out of nonsense rather than throwing', () => {
        for (const raw of [null, '', 'not json', '{}', '[]', '[1,2]', '[{"id":1}]']) {
            expect(parseViews(raw)).toBeNull()
        }
    })

    it('drops the entries that are not views and keeps the rest', () => {
        const raw = JSON.stringify([
            { id: 'a', name: 'A', snapshot: { version: 1 } },
            { id: 'b' },
            null
        ])
        expect(parseViews(raw)).toEqual([{ id: 'a', name: 'A', snapshot: { version: 1 } }])
    })

    it('merges an empty stored list as no list at all', () => {
        const seeded: SavedView[] = [{ id: 'a', name: 'A', snapshot: { version: 1 } }]
        expect(mergeViews(seeded, null)).toEqual(seeded)
    })
})

describe('share links', () => {
    let grid: GridState<Row>

    beforeEach(() => {
        grid = makeGrid()
        getGrouping(grid)!.setGroupBy(['dept'])
    })

    it('round-trips the state through a URL', async () => {
        const link = await getSavedViews(grid)!.shareLink('https://app.test/orders?tab=all')
        expect(link).toContain(`${SHARE_PARAM}=`)

        const fresh = makeGrid()
        expect(getGrouping(fresh)!.by).toEqual([])
        await expect(getSavedViews(fresh)!.applyLink(link!)).resolves.toBe(true)
        expect(getGrouping(fresh)!.by).toEqual(['dept'])
    })

    it('keeps the parameters the link already had', async () => {
        const link = await getSavedViews(grid)!.shareLink('https://app.test/orders?tab=all')
        expect(new URL(link!).searchParams.get('tab')).toBe('all')
    })

    it('leaves the grid alone for a link carrying nothing', async () => {
        const fresh = makeGrid()
        await expect(getSavedViews(fresh)!.applyLink('https://app.test/orders')).resolves.toBe(
            false
        )
    })

    it('leaves the grid alone for a token it cannot read', async () => {
        const fresh = makeGrid()
        getGrouping(fresh)!.setGroupBy(['country'])
        await expect(getSavedViews(fresh)!.applyToken('9nonsense')).resolves.toBe(false)
        expect(getGrouping(fresh)!.by).toEqual(['country'])
    })

    it('stands on no view after a link, because a link is not a saved view', async () => {
        const views = getSavedViews(grid)!
        views.save('Mine')
        expect(views.activeId).not.toBeNull()

        await views.applyToken(await views.shareToken())
        expect(views.activeId).toBeNull()
    })

    it('drops a grouping the receiving grid has no column for', async () => {
        const token = await getSavedViews(grid)!.shareToken()

        const narrow = createDataGrid<Row>({
            columns: [{ id: 'country', header: 'Country' }],
            data,
            getRowId: (row) => String(row.id),
            features: [sorting(), grouping<Row>(), savedViews<Row>({ storage: null })]
        })
        await expect(getSavedViews(narrow)!.applyToken(token)).resolves.toBe(true)
        expect(getGrouping(narrow)!.by).toEqual([])
    })
})
