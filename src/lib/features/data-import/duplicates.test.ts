import { createDataGrid } from '../../core/grid/index.js'
import { type ColumnDef } from '../../core/types/index.js'
import { editing } from '../../features/editing/index.js'
import { describe, expect, it } from 'vitest'
import { dataImport, getDataImport } from './data-import.svelte.js'
import { duplicateKey, duplicateProblems, existingKeys } from './duplicates.js'

const messages = {
    inFile: (key: string) => `${key} twice`,
    inGrid: (key: string) => `${key} already here`
}

describe('the key two rows are the same row by', () => {
    it('reads the columns together, trimmed and without case', () => {
        expect(duplicateKey({ email: ' Chi@Example.COM ' }, ['email'])).toBe('chi@example.com')
        expect(duplicateKey({ a: 'x', b: 2 }, ['a', 'b'])).toBe('x\u00002')
    })

    it('has no key for a row missing part of one, so a blank is never a duplicate', () => {
        expect(duplicateKey({ a: 'x', b: null }, ['a', 'b'])).toBeNull()
        expect(duplicateKey({ a: 'x', b: '  ' }, ['a', 'b'])).toBeNull()
        expect(duplicateKey({ a: 'x' }, [])).toBeNull()
    })

    it('reads a date by the instant it holds, not by how it was typed', () => {
        const one = duplicateKey({ at: new Date(2026, 0, 1) }, ['at'])
        const two = duplicateKey({ at: new Date(2026, 0, 1) }, ['at'])

        expect(one).toBe(two)
        expect(duplicateKey({ at: new Date('nope') }, ['at'])).toBeNull()
    })
})

describe('duplicates inside one file', () => {
    const rows = [{ email: 'a@x.com' }, { email: 'b@x.com' }, { email: 'A@X.com' }]

    it('flags the second sighting and leaves the first alone', () => {
        const found = duplicateProblems(
            rows,
            { columns: ['email'], against: 'file' },
            new Set(),
            messages
        )

        expect(found).toHaveLength(1)
        expect(found[0]!.rowIndex).toBe(2)
        expect(found[0]!.kind).toBe('duplicate')
        expect(found[0]!.columnId).toBe('email')
    })

    it('says nothing about rows the grid already holds when only the file was asked about', () => {
        const found = duplicateProblems(
            [{ email: 'a@x.com' }],
            { columns: ['email'], against: 'file' },
            existingKeys([{ email: 'a@x.com' }], ['email']),
            messages
        )

        expect(found).toEqual([])
    })
})

describe('duplicates against what the grid already holds', () => {
    it('names the row that is already there, and says which', () => {
        const found = duplicateProblems(
            [{ email: 'a@x.com' }],
            { columns: ['email'], against: 'grid' },
            existingKeys([{ email: ' A@x.com ' }], ['email']),
            messages
        )

        expect(found).toHaveLength(1)
        expect(found[0]!.kind).toBe('existing')
        expect(found[0]!.message).toBe('a@x.com already here')
    })

    it('leaves a file that repeats itself alone when only the grid was asked about', () => {
        const found = duplicateProblems(
            [{ email: 'a@x.com' }, { email: 'a@x.com' }],
            { columns: ['email'], against: 'grid' },
            new Set(),
            messages
        )

        expect(found).toEqual([])
    })

    it('answers both questions at once, and calls the older collision the older one', () => {
        const found = duplicateProblems(
            [{ email: 'a@x.com' }, { email: 'b@x.com' }, { email: 'b@x.com' }],
            { columns: ['email'], against: 'both' },
            existingKeys([{ email: 'a@x.com' }], ['email']),
            messages
        )

        expect(found.map((problem) => [problem.rowIndex, problem.kind])).toEqual([
            [0, 'existing'],
            [2, 'duplicate']
        ])
    })
})

interface Member {
    id: number
    email: string
    name: string
}

const columns: ColumnDef<Member>[] = [
    { id: 'email', header: 'Email', editable: true },
    { id: 'name', header: 'Name', editable: true }
]

const FILE = 'Email,Name\nchi@x.com,Chi\nan@x.com,An\nCHI@x.com,Chi again\n'

function importedInto(existing: Member[], against?: 'file' | 'grid' | 'both') {
    const grid = createDataGrid<Member>({
        columns,
        data: existing,
        getRowId: (row) => String(row.id),
        features: [
            editing(),
            dataImport<Member>({
                onCommit: () => {},
                newRow: (index) => ({ id: 100 + index }),
                dedupe: { columns: ['email'], against }
            })
        ]
    })
    return { grid, importing: getDataImport(grid)! }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 20))

describe('a wizard told which column identifies a row', () => {
    it('marks the row the file repeats, and only that one', async () => {
        const { importing } = importedInto([])
        await importing.takeText(FILE)
        await importing.review()

        expect([...importing.badRows]).toEqual([2])
        expect(importing.validCount).toBe(2)
    })

    it('marks a row the grid already has, without touching the rest', async () => {
        const { importing } = importedInto([{ id: 1, email: 'an@x.com', name: 'An' }])
        await importing.takeText(FILE)
        await importing.review()

        expect([...importing.badRows].sort()).toEqual([1, 2])
    })

    it('does not call a staged row a duplicate of itself', async () => {
        const { importing } = importedInto([], 'grid')
        await importing.takeText(FILE)
        await importing.review()

        expect([...importing.badRows]).toEqual([])
    })

    it('clears the mark when the key is edited to something new', async () => {
        const { grid, importing } = importedInto([])
        await importing.takeText(FILE)
        await importing.review()

        grid.api.applyEdits?.([{ rowId: '102', changes: { email: 'moi@x.com' } }])
        await settle()

        expect([...importing.badRows]).toEqual([])
    })

    it('commits the valid rows only when asked, leaving the duplicate behind', async () => {
        const committed: Member[][] = []
        const grid = createDataGrid<Member>({
            columns,
            data: [],
            getRowId: (row) => String(row.id),
            features: [
                editing(),
                dataImport<Member>({
                    onCommit: (rows) => {
                        committed.push(rows)
                    },
                    newRow: (index) => ({ id: 100 + index }),
                    dedupe: { columns: ['email'] }
                })
            ]
        })
        const importing = getDataImport(grid)!

        await importing.takeText(FILE)
        await importing.review()
        await importing.commit({ validOnly: true })

        expect(committed[0]!.map((row) => row.email)).toEqual(['chi@x.com', 'an@x.com'])
    })

    it('says nothing about duplicates when no key was declared', async () => {
        const grid = createDataGrid<Member>({
            columns,
            data: [],
            getRowId: (row) => String(row.id),
            features: [
                editing(),
                dataImport<Member>({ onCommit: () => {}, newRow: (index) => ({ id: 100 + index }) })
            ]
        })
        const importing = getDataImport(grid)!

        await importing.takeText(FILE)
        await importing.review()

        expect([...importing.badRows]).toEqual([])
    })
})
