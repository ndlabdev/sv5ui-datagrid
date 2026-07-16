# @sv5ui/datagrid

A high-performance data grid for Svelte 5, built on [sv5ui](https://github.com/ndlabdev/sv5ui).

> Status: early development. The API is not stable yet.

## Architecture

The package is split into two layers:

- **Headless core** (`createDataGrid`, `DataGridState`) - pure Svelte 5 runes state with a derived row pipeline (`filter → sort → paginate`). No UI dependencies.
- **UI components** (`DataGrid`) - a thin rendering layer on top of the core, using sv5ui components (Icon, Pagination) and theme tokens.

## Installation

```bash
pnpm add @sv5ui/datagrid sv5ui
```

Import the sv5ui theme and register the datagrid source in your Tailwind CSS entry:

```css
@import 'sv5ui/theme.css';

@source '../node_modules/sv5ui/dist';
@source '../node_modules/@sv5ui/datagrid/dist';
```

## Usage

```svelte
<script lang="ts">
    import { DataGrid, createDataGrid, type ColumnDef } from '@sv5ui/datagrid'

    interface Person {
        id: number
        name: string
        age: number
    }

    const columns: ColumnDef<Person>[] = [
        { id: 'name', header: 'Name', sortable: true },
        { id: 'age', header: 'Age', sortable: true, align: 'right' }
    ]

    const grid = createDataGrid({
        data: people,
        columns,
        pageSize: 10,
        getRowId: (person) => String(person.id)
    })
</script>

<DataGrid {grid} />
```

For simple cases, pass `data`/`columns` directly instead of creating a grid instance:

```svelte
<DataGrid {data} {columns} pageSize={10} />
```

## Development

```bash
pnpm install
pnpm dev        # playground
pnpm test       # unit tests
pnpm check      # svelte-check
pnpm lint       # prettier + eslint
```

To develop against a local sv5ui checkout:

```bash
pnpm link ../sv5ui
```

## Roadmap

See [docs/PLAN.md](docs/PLAN.md) for the full architecture and phased roadmap
(kernel, virtualization, column operations, filtering, selection and clipboard,
grouping and tree data, editing, server-side row model).

## License

[MIT](LICENSE)
