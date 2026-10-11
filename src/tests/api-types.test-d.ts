import {
    createDataGrid,
    filtering,
    flashCells,
    pagination,
    sorting,
    type ColumnDef,
    type FilterModel,
    type FlashContext,
    type FlashMark,
    type FlashWay,
    type GridSnapshot,
    type PivotKeepRows,
    type PivotOrderColumns,
    type PivotValuesOn
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

exact<((keep: PivotKeepRows | undefined) => void) | undefined>(grid.api.setPivotKeepRows)
exact<PivotKeepRows | undefined>(grid.api.pivotKeepRows?.())
exact<((order: PivotOrderColumns | undefined) => void) | undefined>(grid.api.setPivotOrderColumns)
exact<PivotOrderColumns | undefined>(grid.api.pivotOrderColumns?.())
exact<((where: PivotValuesOn) => void) | undefined>(grid.api.setPivotValuesOn)
exact<PivotValuesOn | undefined>(grid.api.pivotValuesOn?.())

grid.api.setPivotKeepRows?.({ top: 10, others: 'Rest' })
grid.api.setPivotOrderColumns?.({ direction: 'desc' })
grid.api.setPivotValuesOn?.('rows')

const loudJumps = ({ way, before, after, age }: FlashContext) => {
    const jump = Math.abs(Number(after) - Number(before))
    exact<FlashWay>(way)
    exact<number>(age)
    return jump > 10 ? { class: 'ring-2' } : undefined
}

exact<FlashMark>({ way: 'up', at: 0, before: 1, after: 2 })
exact<FlashContext>({ way: 'down', at: 0, before: 2, after: 1, age: 5 })

createDataGrid<Person>({
    columns,
    data: [] as Person[],
    getRowId: (person) => person.id,
    features: [flashCells<Person>({ appearance: loudJumps })]
})
