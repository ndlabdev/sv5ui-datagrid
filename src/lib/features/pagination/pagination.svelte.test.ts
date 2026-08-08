import { flushSync } from 'svelte'
import { describe, expect, it } from 'vitest'
import { createDataGrid } from '../../core/grid/grid.svelte.js'
import type { ColumnDef } from '../../core/types/index.js'
import { getPagination, pagination } from './index.js'

interface Person {
    id: number
    name: string
}

const columns: ColumnDef<Person>[] = [{ id: 'name' }]

function makePeople(count: number): Person[] {
    return Array.from({ length: count }, (_, i) => ({ id: i + 1, name: `Person ${i + 1}` }))
}

function createGrid(count: number, pageSize = 5) {
    return createDataGrid<Person>({
        columns,
        data: makePeople(count),
        getRowId: (person) => String(person.id),
        features: [pagination({ pageSize })]
    })
}

describe('Pagination — a setter does not subscribe its caller', () => {
    it('turns the page while an effect drives the page size', () => {
        const cleanup = $effect.root(() => {
            const grid = createGrid(30)
            const state = getPagination(grid)!

            // The shape a select bound to page size takes in a real page.
            let choice = $state('5')
            let runs = 0
            $effect(() => {
                runs += 1
                state.setPageSize(Number(choice))
            })

            flushSync()
            expect(runs).toBe(1)

            flushSync(() => state.setPage(2))

            // The effect read only `choice`, so writing the page leaves it alone
            // and page 2 survives instead of being reset to 1.
            expect(runs).toBe(1)
            expect(state.page).toBe(2)
            expect(grid.nodes.map((node) => node.row.name)).toEqual([
                'Person 6',
                'Person 7',
                'Person 8',
                'Person 9',
                'Person 10'
            ])

            flushSync(() => {
                choice = '10'
            })
            expect(runs).toBe(2)
            expect(state.pageSize).toBe(10)
        })
        cleanup()
    })

    it('keeps setRowCount off the pipeline under a server row model', () => {
        const cleanup = $effect.root(() => {
            const grid = createDataGrid<Person>({
                columns,
                data: makePeople(5),
                getRowId: (person) => String(person.id),
                rowModel: 'server',
                features: [pagination({ pageSize: 5 })]
            })
            const state = getPagination(grid)!

            const total = $state(100)
            let runs = 0
            $effect(() => {
                runs += 1
                state.setRowCount(total)
            })

            flushSync()
            expect(runs).toBe(1)

            flushSync(() => state.setPage(3))
            expect(runs).toBe(1)
            expect(state.page).toBe(3)
        })
        cleanup()
    })
})

describe('Pagination — what pageChanged reports', () => {
    it('announces the page the grid actually moved to', () => {
        const grid = createGrid(30)
        const state = getPagination(grid)!
        const seen: { page: number; pageSize: number | null }[] = []
        grid.events.on('pageChanged', (event) => seen.push(event))

        state.setPage(4)
        state.setPage(99)
        state.setPageSize(10)

        expect(seen).toEqual([
            { page: 4, pageSize: 5 },
            { page: 6, pageSize: 5 },
            { page: 1, pageSize: 10 }
        ])
    })
})
