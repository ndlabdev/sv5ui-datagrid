import { flushSync } from 'svelte'
import { describe, expect, it } from 'vitest'
import { createDataGrid } from '../../core/grid/grid.svelte.js'
import type { ColumnDef } from '../../core/types/index.js'
import { filtering, getFiltering } from './index.js'

interface Person {
    id: number
    name: string
}

const columns: ColumnDef<Person>[] = [{ id: 'name', filter: 'text' }]

const people: Person[] = [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
    { id: 3, name: 'Carol' }
]

function createGrid() {
    return createDataGrid<Person>({
        columns,
        data: people,
        getRowId: (person) => String(person.id),
        features: [filtering()]
    })
}

describe('Filtering — a setter does not subscribe its caller', () => {
    it('settles after one run when an effect writes a column filter', () => {
        const cleanup = $effect.root(() => {
            const grid = createGrid()
            const state = getFiltering(grid)!

            // `setColumnFilter` stores a fresh object each call, so an emit that
            // read the model back would re-trigger this effect without end.
            let query = $state('a')
            let runs = 0
            $effect(() => {
                runs += 1
                state.setColumnFilter('name', { kind: 'text', op: 'contains', value: query })
            })

            flushSync()
            expect(runs).toBe(1)
            expect(grid.nodes.map((node) => node.row.name)).toEqual(['Alice', 'Carol'])

            flushSync(() => {
                query = 'bo'
            })
            expect(runs).toBe(2)
            expect(grid.nodes.map((node) => node.row.name)).toEqual(['Bob'])
        })
        cleanup()
    })

    it('settles after one run when an effect writes the quick filter', () => {
        const cleanup = $effect.root(() => {
            const grid = createGrid()
            const state = getFiltering(grid)!

            let query = $state('car')
            let runs = 0
            $effect(() => {
                runs += 1
                state.setQuickFilter(query)
            })

            flushSync()
            expect(runs).toBe(1)
            expect(grid.nodes.map((node) => node.row.name)).toEqual(['Carol'])
        })
        cleanup()
    })
})

describe('Filtering — what filterChanged reports', () => {
    it('carries the model as it stands after the write', () => {
        const grid = createGrid()
        const state = getFiltering(grid)!
        const seen: unknown[] = []
        grid.events.on('filterChanged', (event) => seen.push(event.filter))

        state.setQuickFilter('a')
        state.setColumnFilter('name', { kind: 'text', op: 'contains', value: 'bo' })

        expect(seen).toEqual([
            { quick: 'a', columns: {} },
            { quick: 'a', columns: { name: { kind: 'text', op: 'contains', value: 'bo' } } }
        ])
    })
})
