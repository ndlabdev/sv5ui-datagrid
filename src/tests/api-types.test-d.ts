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
    features: [sorting(), filtering(), pagination({ pageSize: 25 })]
})

function exact<T>(value: T): T {
    return value
}

exact<GridSnapshot>(grid.api.getState())
grid.api.setState(grid.api.getState())

exact<((page: number) => void) | undefined>(grid.api.setPage)
exact<((rowCount: number | null) => void) | undefined>(grid.api.setRowCount)
exact<FilterModel | undefined>(grid.api.getFilterModel?.())
grid.api.setPage?.(2)

exact<Person[]>(grid.data)
exact<string>(grid.getRowId({ id: '1', name: 'Alice' }))
