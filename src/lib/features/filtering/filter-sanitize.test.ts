import { describe, expect, it } from 'vitest'
import { createDataGrid } from '../../core/grid/index.js'
import type { ColumnDef, ColumnFilter } from '../../core/types/index.js'
import { filtering, getFiltering, sanitizeFilterModel } from './index.js'

interface Row {
    id: number
    total: number
    name: string
    when: string
    ok: boolean
}

const columns: ColumnDef<Row>[] = [
    { id: 'total', header: 'Total', filter: 'number' },
    { id: 'name', header: 'Name', filter: 'text' },
    { id: 'when', header: 'When', filter: 'date' },
    { id: 'ok', header: 'Ok', filter: 'boolean' }
]

const data: Row[] = [
    { id: 1, total: 10, name: 'alpha', when: '2026-01-02', ok: true },
    { id: 2, total: 20, name: 'beta', when: '2026-02-02', ok: false }
]

function gridWith(columnId: string, filter: unknown) {
    const grid = createDataGrid<Row>({
        columns,
        data,
        getRowId: (row) => String(row.id),
        features: [filtering()]
    })
    grid.setState({
        version: 1,
        features: { filtering: { quick: '', columns: { [columnId]: filter } } }
    } as never)
    return grid
}

describe('sanitizeFilterModel', () => {
    it('keeps a model the editor could have built', () => {
        const model = sanitizeFilterModel({
            quick: 'ph',
            columns: {
                total: { kind: 'number', op: 'gt', value: 15 },
                name: { kind: 'text', op: 'contains', value: 'al', caseSensitive: true }
            }
        })

        expect(model).toEqual({
            quick: 'ph',
            columns: {
                total: { kind: 'number', op: 'gt', value: 15 },
                name: { kind: 'text', op: 'contains', value: 'al', caseSensitive: true }
            }
        })
    })

    it('reads a group, dropping only the conditions that are broken', () => {
        const model = sanitizeFilterModel({
            quick: '',
            columns: {
                name: {
                    kind: 'group',
                    join: 'or',
                    conditions: [
                        { kind: 'text', op: 'contains', value: 'al' },
                        { kind: 'text', op: 'eq', value: 'beta' }
                    ]
                }
            }
        })

        expect(model?.columns.name).toEqual({
            kind: 'group',
            join: 'or',
            conditions: [{ kind: 'text', op: 'contains', value: 'al' }]
        })
    })

    it('drops a group whose conditions are not a list, and one left with none', () => {
        const model = sanitizeFilterModel({
            columns: {
                name: { kind: 'group', join: 'and', conditions: 'nope' },
                when: { kind: 'group', join: 'and', conditions: [{ kind: 'date', op: 'gt' }] }
            }
        })

        expect(model).toEqual({ quick: '', columns: {} })
    })

    it('takes a presence operator with no value, in either spelling', () => {
        const model = sanitizeFilterModel({
            columns: {
                name: { kind: 'text', op: 'blank' },
                total: { kind: 'number', op: 'notBlank' }
            }
        })

        expect(model?.columns).toEqual({
            name: { kind: 'text', op: 'blank', value: '' },
            total: { kind: 'number', op: 'notBlank' }
        })
    })

    it('rejects a slice that is not an object', () => {
        expect(sanitizeFilterModel(null)).toBeNull()
        expect(sanitizeFilterModel('filtered')).toBeNull()
        expect(sanitizeFilterModel([])).toBeNull()
    })

    it('falls back to an empty quick filter rather than carrying junk', () => {
        expect(sanitizeFilterModel({ quick: 42, columns: 'nope' })).toEqual({
            quick: '',
            columns: {}
        })
    })
})

describe('hydrating a malformed filter snapshot', () => {
    // One case per row of the table measured on 1.3.0, where six of the seven
    // threw while the pipeline was reading them.
    const cases: [string, string, unknown][] = [
        [
            'a number operator spelled as the text one',
            'total',
            {
                kind: 'number',
                op: 'equals',
                value: 10
            }
        ],
        [
            'a text operator spelled as the number one',
            'name',
            {
                kind: 'text',
                op: 'eq',
                value: 'alpha'
            }
        ],
        [
            'a date operator spelled as the number one',
            'when',
            {
                kind: 'date',
                op: 'gt',
                value: '2026-01-01'
            }
        ],
        ['a set whose values are not a list', 'name', { kind: 'set', values: {} }],
        ['a kind nothing knows', 'name', { kind: 'nonsense', op: 'eq' }],
        ['a text condition with no value', 'name', { kind: 'text', op: 'contains' }],
        ['a boolean value that is not a boolean', 'ok', { kind: 'boolean', value: 'yes' }]
    ]

    for (const [label, columnId, filter] of cases) {
        it(`reads every row and does not throw: ${label}`, () => {
            const grid = gridWith(columnId, filter)

            expect(() => grid.nodes).not.toThrow()
            expect(grid.nodes).toHaveLength(2)
            expect(getFiltering(grid)?.columnFilters).toEqual({})
        })
    }

    it('keeps the readable column when another is dropped', () => {
        const grid = createDataGrid<Row>({
            columns,
            data,
            getRowId: (row) => String(row.id),
            features: [filtering()]
        })
        grid.setState({
            version: 1,
            features: {
                filtering: {
                    quick: '',
                    columns: {
                        total: { kind: 'number', op: 'gt', value: 15 },
                        name: { kind: 'text', op: 'eq', value: 'alpha' }
                    }
                }
            }
        } as never)

        expect(grid.nodes).toHaveLength(1)
        expect(grid.nodes[0]?.row.name).toBe('beta')
    })
})

describe('a broken condition set through the public API', () => {
    // `applyFilterModel` does not sanitize: it is typed, and an app calling it
    // has said what the model is. The predicate layer is what keeps a model
    // that lied from reaching the pipeline as a throw.
    const conditions: [string, string, ColumnFilter][] = [
        ['an operator from another kind', 'total', { kind: 'number', op: 'equals' } as never],
        ['a text operator from another kind', 'name', { kind: 'text', op: 'eq' } as never],
        ['a date operator from another kind', 'when', { kind: 'date', op: 'gt' } as never],
        ['a set whose values are not a list', 'name', { kind: 'set', values: {} } as never],
        ['a kind nothing knows', 'name', { kind: 'nonsense' } as never],
        ['a text condition with no value', 'name', { kind: 'text', op: 'contains' } as never],
        [
            'a group whose conditions are not a list',
            'name',
            { kind: 'group', join: 'and', conditions: 'nope' } as never
        ]
    ]

    for (const [label, columnId, condition] of conditions) {
        it(`passes every row rather than throwing: ${label}`, () => {
            const grid = createDataGrid<Row>({
                columns,
                data,
                getRowId: (row) => String(row.id),
                features: [filtering()]
            })
            getFiltering(grid)?.applyFilterModel({ quick: '', columns: { [columnId]: condition } })

            expect(() => grid.nodes).not.toThrow()
            expect(grid.nodes).toHaveLength(2)
        })
    }
})
