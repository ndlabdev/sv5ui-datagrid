import { createDataGrid, type GridState } from '../../core/grid/index.js'
import { type ColumnDef, type ColumnFilter } from '../../core/types/index.js'
import { filtering } from '../../features/filtering/index.js'
import { describe, expect, it } from 'vitest'
import { advancedFilter, getAdvancedFilter } from './advanced-filter.svelte.js'
import type { FilterCondition } from './advanced-filter.types.js'

interface Row {
    id: number
    text: string | null
    num: number | null
    day: string | Date | null
    flag: boolean | null
}

const rows: Row[] = [
    { id: 1, text: 'Alpha', num: 5, day: '2026-03-02', flag: true },
    { id: 2, text: 'alpha beta', num: 10, day: new Date(2026, 2, 2, 10, 30), flag: false },
    { id: 3, text: 'Gamma', num: 0, day: '2026-03-31T09:00:00', flag: true },
    { id: 4, text: '', num: null, day: null, flag: null },
    { id: 5, text: null, num: -3, day: '2026-12-31', flag: false }
]

const columns: ColumnDef<Row>[] = [
    { id: 'text', header: 'Text', filter: 'text' },
    { id: 'num', header: 'Num', filter: 'number' },
    { id: 'day', header: 'Day', type: 'date', filter: 'date' },
    { id: 'flag', header: 'Flag', type: 'boolean', filter: 'boolean' }
]

function surviving(grid: GridState<Row>): number[] {
    return grid.preWindowNodes.map((node) => node.row.id)
}

function throughColumnFilter(columnId: string, filter: ColumnFilter): number[] {
    const grid = createDataGrid<Row>({
        columns,
        data: rows,
        getRowId: (row) => String(row.id),
        features: [filtering()]
    })
    grid.api.setColumnFilter!(columnId, filter)
    return surviving(grid)
}

function throughBuilder(condition: Omit<FilterCondition, 'kind'>): number[] {
    const grid = createDataGrid<Row>({
        columns,
        data: rows,
        getRowId: (row) => String(row.id),
        features: [advancedFilter<Row>()]
    })
    getAdvancedFilter(grid)!.setModel({
        kind: 'group',
        join: 'and',
        children: [{ kind: 'condition', ...condition }]
    })
    return surviving(grid)
}

const cases: [string, string, ColumnFilter, Omit<FilterCondition, 'kind'>][] = [
    [
        'text contains',
        'text',
        { kind: 'text', op: 'contains', value: 'alpha' },
        { columnId: 'text', op: 'contains', value: 'alpha' }
    ],
    [
        'text contains, case sensitive',
        'text',
        { kind: 'text', op: 'contains', value: 'alpha', caseSensitive: true },
        { columnId: 'text', op: 'contains', value: 'alpha', caseSensitive: true }
    ],
    [
        'text notContains',
        'text',
        { kind: 'text', op: 'notContains', value: 'alpha' },
        { columnId: 'text', op: 'notContains', value: 'alpha' }
    ],
    [
        'text equals',
        'text',
        { kind: 'text', op: 'equals', value: 'Gamma' },
        { columnId: 'text', op: 'equals', value: 'Gamma' }
    ],
    [
        'text notEqual',
        'text',
        { kind: 'text', op: 'notEqual', value: 'Gamma' },
        { columnId: 'text', op: 'notEqual', value: 'Gamma' }
    ],
    [
        'text startsWith',
        'text',
        { kind: 'text', op: 'startsWith', value: 'al' },
        { columnId: 'text', op: 'startsWith', value: 'al' }
    ],
    [
        'text endsWith',
        'text',
        { kind: 'text', op: 'endsWith', value: 'a' },
        { columnId: 'text', op: 'endsWith', value: 'a' }
    ],
    [
        'text blank',
        'text',
        { kind: 'text', op: 'blank', value: '' },
        { columnId: 'text', op: 'blank' }
    ],
    [
        'text notBlank',
        'text',
        { kind: 'text', op: 'notBlank', value: '' },
        { columnId: 'text', op: 'notBlank' }
    ],
    [
        'number gt',
        'num',
        { kind: 'number', op: 'gt', value: 0 },
        { columnId: 'num', op: 'gt', value: 0 }
    ],
    [
        'number gte',
        'num',
        { kind: 'number', op: 'gte', value: 5 },
        { columnId: 'num', op: 'gte', value: 5 }
    ],
    [
        'number lt',
        'num',
        { kind: 'number', op: 'lt', value: 5 },
        { columnId: 'num', op: 'lt', value: 5 }
    ],
    [
        'number eq',
        'num',
        { kind: 'number', op: 'eq', value: 0 },
        { columnId: 'num', op: 'equals', value: 0 }
    ],
    [
        'number between',
        'num',
        { kind: 'number', op: 'between', value: 0, to: 10 },
        { columnId: 'num', op: 'between', value: 0, to: 10 }
    ],
    ['number blank', 'num', { kind: 'number', op: 'blank' }, { columnId: 'num', op: 'blank' }],
    [
        'date equals',
        'day',
        { kind: 'date', op: 'equals', value: '2026-03-02' },
        { columnId: 'day', op: 'equals', value: '2026-03-02' }
    ],
    [
        'date before',
        'day',
        { kind: 'date', op: 'before', value: '2026-03-31' },
        { columnId: 'day', op: 'before', value: '2026-03-31' }
    ],
    [
        'date after',
        'day',
        { kind: 'date', op: 'after', value: '2026-03-02' },
        { columnId: 'day', op: 'after', value: '2026-03-02' }
    ],
    [
        'date between',
        'day',
        { kind: 'date', op: 'between', value: '2026-01-01', to: '2026-03-31' },
        { columnId: 'day', op: 'between', value: '2026-01-01', to: '2026-03-31' }
    ],
    ['date blank', 'day', { kind: 'date', op: 'blank' }, { columnId: 'day', op: 'blank' }],
    [
        'set of two',
        'text',
        { kind: 'set', values: ['Alpha', 'Gamma'] },
        { columnId: 'text', op: 'in', values: ['Alpha', 'Gamma'] }
    ],
    [
        'boolean true',
        'flag',
        { kind: 'boolean', value: true },
        { columnId: 'flag', op: 'equals', value: true }
    ]
]

describe('the builder answers a condition the way a column filter does', () => {
    it.each(cases)('%s', (_label, columnId, columnFilter, condition) => {
        expect(throughBuilder(condition)).toEqual(throughColumnFilter(columnId, columnFilter))
    })
})

describe('the one answer that differs, and why it is not copied', () => {
    it('keeps a blank cell out of a negative test, where a column filter drops it', () => {
        const plain = throughColumnFilter('num', { kind: 'number', op: 'neq', value: 5 })
        const built = throughBuilder({ columnId: 'num', op: 'notEqual', value: 5 })

        expect(plain).toEqual([2, 3, 5])
        expect(built).toEqual([2, 3, 4, 5])
    })

    it('answers a blank the same way a column filter answers one on text', () => {
        expect(
            throughColumnFilter('text', { kind: 'text', op: 'notEqual', value: 'Gamma' })
        ).toContain(4)
    })
})
