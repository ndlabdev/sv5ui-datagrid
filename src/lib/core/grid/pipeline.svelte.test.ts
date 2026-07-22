import { flushSync } from 'svelte'
import { describe, expect, it } from 'vitest'
import { filtering, getFiltering } from '../../features/filtering/index.js'
import { pagination } from '../../features/pagination/index.js'
import { getSorting, sorting } from '../../features/sorting/index.js'
import { createDataGrid } from './grid.svelte.js'
import type { GridFeature } from '../types.js'

interface Person {
    id: number
    name: string
}

const people: Person[] = [
    { id: 1, name: 'Charlie' },
    { id: 2, name: 'Alice' },
    { id: 3, name: 'Bob' },
    { id: 4, name: 'Dave' },
    { id: 5, name: 'Erin' }
]

describe('pipeline memoization', () => {
    it('does not re-run upstream stages when downstream state changes', () => {
        let calls = 0
        const counter: GridFeature<Person> = {
            id: 'counter',
            pipelineStage: {
                order: 150,
                transform: (nodes) => {
                    calls += 1
                    return nodes
                }
            }
        }

        const cleanup = $effect.root(() => {
            const grid = createDataGrid<Person>({
                columns: [{ id: 'name', sortable: true }],
                data: people,
                getRowId: (person) => String(person.id),
                features: [filtering(), counter, sorting(), pagination({ pageSize: 2 })]
            })

            $effect(() => {
                void grid.nodes
            })

            flushSync()
            expect(calls).toBe(1)

            flushSync(() => getSorting(grid)!.toggleSort('name'))
            expect(calls).toBe(1)

            flushSync(() => getFiltering(grid)!.setQuickFilter('a'))
            expect(calls).toBe(2)
        })
        cleanup()
    })
})
