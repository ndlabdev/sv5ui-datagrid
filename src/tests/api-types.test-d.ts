/**
 * Compile-time only. Neither vitest project matches `*.test-d.ts`, so nothing
 * here runs — `npm run check` is what holds these shapes, and a regression
 * shows up as a type error rather than a failing assertion. It lives outside
 * `src/lib` so it stays out of the published package.
 */
import {
    createDataGrid,
    filtering,
    pagination,
    sorting,
    type ColumnDef,
    type FilterModel,
    type GridSnapshot
} from '$lib/index.js'

interface Person {
    id: string
    name: string
}

const columns: ColumnDef<Person>[] = [{ id: 'name', accessor: (person) => person.name }]

const grid = createDataGrid<Person>({
    columns,
    data: [] as Person[],
    getRowId: (person) => person.id,
    // Written in place, so TRow is inferred from the array's own type. A factory
    // held in a variable first resolves to GridFeature<unknown> and needs the
    // argument spelled out: `const s = sorting<Person>()`.
    features: [sorting(), filtering(), pagination({ pageSize: 25 })]
})

/** Fails to compile if the annotation and the expression disagree. */
function exact<T>(value: T): T {
    return value
}

// The kernel's own methods are always there, and callable without a guard.
exact<GridSnapshot>(grid.api.getState())
grid.api.setState(grid.api.getState())

// A feature method is optional: the grid that has it is the one that registered
// the feature. `?.` is the price of the flat bag.
exact<((page: number) => void) | undefined>(grid.api.setPage)
exact<((rowCount: number | null) => void) | undefined>(grid.api.setRowCount)
exact<FilterModel | undefined>(grid.api.getFilterModel?.())
grid.api.setPage?.(2)

// TRow survives the features array.
exact<Person[]>(grid.data)
exact<string>(grid.getRowId({ id: '1', name: 'Alice' }))
