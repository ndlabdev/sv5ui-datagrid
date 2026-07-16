<script lang="ts">
    import { Container, Input, ThemeModeButton } from 'sv5ui'
    import {
        createDataGrid,
        DataGrid,
        filtering,
        getFiltering,
        Grid,
        pagination,
        sorting,
        type ColumnDef
    } from '$lib/index.js'

    interface Person {
        id: number
        name: string
        email: string
        role: string
        age: number
    }

    const people: Person[] = [
        { id: 1, name: 'Alice Nguyen', email: 'alice@example.com', role: 'Engineer', age: 29 },
        { id: 2, name: 'Bob Tran', email: 'bob@example.com', role: 'Designer', age: 34 },
        { id: 3, name: 'Charlie Le', email: 'charlie@example.com', role: 'Manager', age: 41 },
        { id: 4, name: 'Diana Pham', email: 'diana@example.com', role: 'Engineer', age: 26 },
        { id: 5, name: 'Ethan Vo', email: 'ethan@example.com', role: 'Analyst', age: 31 },
        { id: 6, name: 'Fiona Dang', email: 'fiona@example.com', role: 'Engineer', age: 38 },
        { id: 7, name: 'George Ho', email: 'george@example.com', role: 'Designer', age: 27 },
        { id: 8, name: 'Hana Bui', email: 'hana@example.com', role: 'Manager', age: 45 },
        { id: 9, name: 'Ivan Do', email: 'ivan@example.com', role: 'Analyst', age: 24 },
        { id: 10, name: 'Julia Ly', email: 'julia@example.com', role: 'Engineer', age: 33 },
        { id: 11, name: 'Kevin Truong', email: 'kevin@example.com', role: 'Designer', age: 30 },
        { id: 12, name: 'Linh Hoang', email: 'linh@example.com', role: 'Engineer', age: 28 }
    ]

    const columns: ColumnDef<Person>[] = [
        { id: 'name', header: 'Name', sortable: true, flex: 1, minWidth: 160 },
        { id: 'email', header: 'Email', flex: 1, minWidth: 200 },
        { id: 'role', header: 'Role', sortable: true, width: 140 },
        { id: 'age', header: 'Age', sortable: true, align: 'right', width: 96 }
    ]

    const grid = createDataGrid<Person>({
        data: people,
        columns,
        getRowId: (person) => String(person.id),
        features: [filtering(), sorting(), pagination({ pageSize: 5 })]
    })

    let search = $state('')

    $effect(() => {
        getFiltering(grid)?.setQuickFilter(search)
    })

    const compoundGrid = createDataGrid<Person>({
        data: people.slice(0, 6),
        columns,
        getRowId: (person) => String(person.id),
        features: [sorting()]
    })
</script>

<Container class="space-y-6 py-10">
    <div class="flex items-center justify-between">
        <div class="space-y-1">
            <h1 class="text-2xl font-semibold text-on-surface">@sv5ui/datagrid</h1>
            <p class="text-sm text-on-surface-variant">
                A high-performance data grid for Svelte 5, built on sv5ui.
            </p>
        </div>
        <ThemeModeButton />
    </div>

    <section class="space-y-3">
        <h2 class="text-lg font-medium text-on-surface">Batteries included</h2>
        <Input placeholder="Search all columns..." icon="lucide:search" bind:value={search} />
        <DataGrid {grid} />
    </section>

    <section class="space-y-3">
        <h2 class="text-lg font-medium text-on-surface">Compound composition</h2>
        <Grid.Root grid={compoundGrid}>
            <Grid.Viewport>
                <Grid.Header />
                <Grid.Body />
            </Grid.Viewport>
        </Grid.Root>
    </section>
</Container>
