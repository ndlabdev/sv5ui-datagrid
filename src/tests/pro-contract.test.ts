/**
 * The surface `@sv5ui/datagrid-pro` builds on. Every assertion stands for a
 * real call site there, so deleting one is a decision to break Pro.
 */
import { describe, expect, it } from 'vitest'
import {
    createDataGrid,
    getCellValue,
    getFiltering,
    getPagination,
    getSorting,
    PIPELINE_ORDER,
    SELECTION_COLUMN_ID,
    toFilterRequest,
    toTsv,
    type ColumnState,
    type FilterRequest,
    type RowMeta,
    type SortState
} from '$lib/index.js'

interface Row {
    id: number
    name: string
}

function makeGrid() {
    return createDataGrid<Row>({
        columns: [{ id: 'name', header: 'Name', filter: 'text' }],
        data: [{ id: 1, name: 'Ada' }],
        getRowId: (row) => String(row.id)
    })
}

describe('surface consumed by @sv5ui/datagrid-pro', () => {
    it('keeps the pipeline slots a pro feature inserts itself between', () => {
        // grouping, tree and master/detail all order against these.
        for (const stage of ['filter', 'sort', 'group', 'flatten'] as const) {
            expect(typeof PIPELINE_ORDER[stage]).toBe('number')
        }
    })

    it('keeps the helpers pro features call per row', () => {
        const grid = makeGrid()
        // Aggregation, xlsx export and range copy all read values this way.
        expect(getCellValue({ id: 1, name: 'Ada' }, { id: 'name' })).toBe('Ada')
        expect(SELECTION_COLUMN_ID).toBe('__dg-select__')
        expect(typeof toTsv).toBe('function')
        expect(grid.columns.get('name')).toBeDefined()
    })

    it('exposes column headers as plain text', () => {
        // GroupPanel, xlsx export, range copy and the command palette all
        // render `header` directly. A snippet would break every one of them,
        // which is why `headerCell` is a separate field.
        const column = makeGrid().columns.get('name') as ColumnState<Row>
        expect(typeof column.header).toBe('string')
    })

    it('reaches sorting, filtering and pagination through typed accessors', () => {
        const grid = makeGrid()
        // The server row model builds its request from these. Reading them off
        // `grid.api` by string name compiled fine and broke at runtime.
        expect(getSorting(grid)).toBeUndefined()
        expect(getFiltering(grid)).toBeUndefined()
        expect(getPagination(grid)).toBeUndefined()
    })

    it('builds a request-shaped filter regardless of the model shape', () => {
        const request: FilterRequest = toFilterRequest({
            quick: '',
            columns: {
                a: { kind: 'text', op: 'contains', value: 'x' },
                b: {
                    kind: 'group',
                    join: 'or',
                    conditions: [
                        { kind: 'number', op: 'gt', value: 1 },
                        { kind: 'number', op: 'lt', value: 9 }
                    ]
                }
            }
        })

        // One shape on the wire: a server never branches on which it got.
        for (const entry of Object.values(request.columns)) {
            expect(Array.isArray(entry.conditions)).toBe(true)
            expect(['and', 'or']).toContain(entry.join)
        }
    })

    it('keeps the row metadata pro row structures write', () => {
        const meta: RowMeta = { level: 1, expandable: true, fullWidth: false }
        const sort: SortState[] = [{ columnId: 'name', direction: 'asc' }]
        expect(meta.level).toBe(1)
        expect(sort[0].direction).toBe('asc')
    })
})
