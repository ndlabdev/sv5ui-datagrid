import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildRowNodes, nodesById } from './row-node.js'

interface Row {
    id: string
    name: string
}

const build = (rows: Row[]) => buildRowNodes(rows, (row) => row.id)

afterEach(() => {
    vi.restoreAllMocks()
})

describe('nodesById', () => {
    it('keys every row by its id', () => {
        const index = nodesById(
            build([
                { id: 'a', name: 'first' },
                { id: 'b', name: 'second' }
            ])
        )

        expect(index.size).toBe(2)
        expect(index.get('a')?.row.name).toBe('first')
    })

    it('says nothing when the ids are unique', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        nodesById(
            build([
                { id: 'a', name: 'first' },
                { id: 'b', name: 'second' }
            ])
        )

        expect(warn).not.toHaveBeenCalled()
    })

    it('names the ids that collided', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        nodesById(
            build([
                { id: 'a', name: 'first' },
                { id: 'a', name: 'second' },
                { id: 'b', name: 'third' }
            ])
        )

        expect(warn).toHaveBeenCalledTimes(1)
        const message = warn.mock.calls[0]?.[0] as string
        expect(message).toContain('getRowId')
        expect(message).toContain('a')
        expect(message).toContain('3 rows share 2 ids')
    })

    it('caps the list rather than printing every id of a broken set', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const rows = Array.from({ length: 20 }, (_, i) => ({ id: `dup-${i % 10}`, name: `r${i}` }))
        nodesById(build(rows))

        const message = warn.mock.calls[0]?.[0] as string
        expect(message).toContain('and 5 more')
    })

    it('keeps the last row for a repeated id, which is why it warns', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {})
        const index = nodesById(
            build([
                { id: 'a', name: 'first' },
                { id: 'a', name: 'second' }
            ])
        )

        expect(index.size).toBe(1)
        expect(index.get('a')?.row.name).toBe('second')
    })
})
