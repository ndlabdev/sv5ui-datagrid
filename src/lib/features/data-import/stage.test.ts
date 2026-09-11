import { type ColumnDef } from '../../core/types/index.js'
import { describe, expect, it } from 'vitest'
import { guessMapping, rememberMapping } from './mapping.js'
import { problemRows, problemsByMessage, stageRows } from './stage.js'

interface Member {
    id: number
    name: string
    email: string
    joined: Date | null
    active: boolean
    salary: number
}

const columns: ColumnDef<Member>[] = [
    { id: 'name', header: 'Full name' },
    {
        id: 'email',
        header: 'Email',
        validate: (value) => (String(value ?? '').includes('@') ? null : 'Email needs an @')
    },
    { id: 'joined', header: 'Joined', type: 'date' },
    { id: 'active', header: 'Active', type: 'boolean' },
    { id: 'salary', header: 'Salary', type: 'currency' }
]

describe('guessing which source column is which', () => {
    it('matches on the header a person wrote', () => {
        const mapping = guessMapping(columns, ['Full name', 'Email', 'Joined', 'Active', 'Salary'])
        expect(mapping.map((entry) => entry.sourceIndex)).toEqual([0, 1, 2, 3, 4])
    })

    it('matches through case, spaces and Vietnamese diacritics', () => {
        const local: ColumnDef<Member>[] = [{ id: 'name', header: 'Họ tên' }]
        expect(guessMapping(local, ['ho ten'])[0]!.sourceIndex).toBe(0)
    })

    it('matches on the column id when the header does not help', () => {
        const mapping = guessMapping(columns, ['name', 'email', 'joined', 'active', 'salary'])
        expect(mapping.every((entry) => entry.sourceIndex !== null)).toBe(true)
    })

    it('leaves a column unmapped rather than guessing twice into one source', () => {
        const mapping = guessMapping(columns, ['Email'])
        const used = mapping.filter((entry) => entry.sourceIndex !== null)
        expect(used).toHaveLength(1)
        expect(used[0]!.columnId).toBe('email')
    })

    it('prefers what it was told to remember, by name rather than by position', () => {
        const remembered = { salary: 'Salary' }
        const mapping = guessMapping(columns, ['Salary', 'Full name'], remembered)
        expect(mapping.find((entry) => entry.columnId === 'salary')!.sourceIndex).toBe(0)
        expect(mapping.find((entry) => entry.columnId === 'name')!.sourceIndex).toBe(1)
    })

    it('follows a remembered column that moved rather than the position it held', () => {
        const remembered = { salary: 'Salary' }
        const mapping = guessMapping(columns, ['Full name', 'Salary'], remembered)
        expect(mapping.find((entry) => entry.columnId === 'salary')!.sourceIndex).toBe(1)
    })

    it('forgets a remembered column the new file does not have', () => {
        const remembered = { salary: 'Salary', name: 'Full name' }
        const mapping = guessMapping(columns, ['Alpha', 'Beta'], remembered)
        expect(mapping.every((entry) => entry.sourceIndex === null)).toBe(true)
    })

    it('refuses a guess that is coincidence rather than evidence', () => {
        const mapped = guessMapping(columns, ['Paid', 'Company Name', 'Valid', 'Nickname'])
        expect(mapped.every((entry) => entry.sourceIndex === null)).toBe(true)
    })

    it('still takes a prefix long enough to mean something', () => {
        expect(guessMapping(columns, ['Email address'])[1]!.columnId).toBe('email')
        expect(
            guessMapping(columns, ['Email address']).find((entry) => entry.columnId === 'email')!
                .sourceIndex
        ).toBe(0)
    })

    it('maps nothing when a file shares nothing with the grid', () => {
        const mapped = guessMapping(columns, ['Alpha', 'Beta', 'Gamma'])
        expect(mapped.every((entry) => entry.sourceIndex === null)).toBe(true)
    })

    it('gives back a mapping worth remembering', () => {
        const headers = ['Full name', 'Email']
        const mapping = guessMapping(columns, headers)
        expect(rememberMapping(mapping, headers)).toEqual({
            name: 'Full name',
            email: 'Email'
        })
    })
})

describe('staging a file into rows', () => {
    const headers = ['Full name', 'Email', 'Joined', 'Active', 'Salary']
    const mapping = guessMapping(columns, headers)

    it('builds the rows a good file describes', async () => {
        const { rows, problems } = await stageRows(
            [['Chi', 'chi@x.vn', '2026-03-02', 'Có', '1.234,50']],
            mapping,
            columns
        )

        expect(problems).toEqual([])
        expect(rows[0]!.name).toBe('Chi')
        expect(rows[0]!.active).toBe(true)
        expect(rows[0]!.salary).toBe(1234.5)
        expect(rows[0]!.joined).toBeInstanceOf(Date)
    })

    it('names the cell it could not read and keeps the text it was given', async () => {
        const { rows, problems } = await stageRows(
            [['An', 'an@x.vn', 'soon', 'maybe', 'abc']],
            mapping,
            columns
        )

        expect(problems.map((problem) => [problem.columnId, problem.kind])).toEqual([
            ['joined', 'date'],
            ['active', 'boolean'],
            ['salary', 'number']
        ])
        expect(rows[0]!.joined).toBe('soon')
    })

    it('runs the column validation an app already wrote for editing', async () => {
        const { problems } = await stageRows(
            [['Chi', 'not-an-email', '', '', '']],
            mapping,
            columns
        )

        expect(problems).toHaveLength(1)
        expect(problems[0]!.message).toBe('Email needs an @')
        expect(problems[0]!.kind).toBe('invalid')
    })

    it('does not validate a cell it already could not read', async () => {
        const withBoth: ColumnDef<Member>[] = [
            { id: 'salary', header: 'Salary', type: 'currency', validate: () => 'never runs' }
        ]
        const { problems } = await stageRows(
            [['abc']],
            guessMapping(withBoth, ['Salary']),
            withBoth
        )

        expect(problems.map((problem) => problem.kind)).toEqual(['number'])
    })

    it('leaves a seeded value alone when the row simply has no such cell', async () => {
        const { rows } = await stageRows([['Chi']], mapping, columns, {
            newRow: () => ({ salary: 42 })
        })

        expect(rows[0]!.salary).toBe(42)
        expect(rows[0]!.name).toBe('Chi')
    })

    it('writes null when the cell is there and empty, which is what the file said', async () => {
        const { rows } = await stageRows([['Chi', '', '', '', '']], mapping, columns, {
            newRow: () => ({ salary: 42 })
        })

        expect(rows[0]!.salary).toBeNull()
    })

    it('seeds each row with what the app supplies', async () => {
        const { rows } = await stageRows([['Chi', 'chi@x.vn', '', '', '']], mapping, columns, {
            newRow: (index) => ({ id: index + 1 })
        })

        expect(rows[0]!.id).toBe(1)
    })

    it('leaves a formula-looking cell as text rather than running anything', async () => {
        const { rows, problems } = await stageRows(
            [['=cmd|/c calc', 'x@y.z', '', '', '']],
            mapping,
            columns
        )

        expect(problems).toEqual([])
        expect(rows[0]!.name).toBe('=cmd|/c calc')
    })

    it('waits for a schema that answers asynchronously', async () => {
        const slow: ColumnDef<Member>[] = [
            {
                id: 'name',
                header: 'Full name',
                schema: {
                    '~standard': {
                        version: 1,
                        vendor: 'test',
                        validate: async (value: unknown) =>
                            String(value) === 'Chi' ? { value } : { issues: [{ message: 'nope' }] }
                    }
                } as never
            }
        ]
        const mapped = guessMapping(slow, ['Full name'])

        expect((await stageRows([['Chi']], mapped, slow)).problems).toEqual([])
        expect((await stageRows([['An']], mapped, slow)).problems[0]?.message).toBe('nope')
    })
})

describe('counting what went wrong', () => {
    it('lists the rows that hold a problem', () => {
        expect([
            ...problemRows([
                { rowIndex: 2, columnId: 'a', kind: 'invalid', message: 'x' },
                { rowIndex: 2, columnId: 'b', kind: 'invalid', message: 'x' },
                { rowIndex: 5, columnId: 'a', kind: 'number', message: 'y' }
            ])
        ]).toEqual([2, 5])
    })

    it('groups them by what they say, worst first', () => {
        expect(
            problemsByMessage([
                { rowIndex: 1, columnId: 'a', kind: 'invalid', message: 'rare' },
                { rowIndex: 2, columnId: 'a', kind: 'invalid', message: 'common' },
                { rowIndex: 3, columnId: 'a', kind: 'invalid', message: 'common' }
            ])
        ).toEqual([
            { message: 'common', count: 2 },
            { message: 'rare', count: 1 }
        ])
    })
})
