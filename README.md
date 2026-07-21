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

## Extension points

Every feature — the built-in ones and yours — is a plain object plugging into the same hooks,
so anything the package ships can be built from outside it:

| Hook             | What it does                                                     |
| ---------------- | ---------------------------------------------------------------- |
| `pipelineStage`  | an ordered, pure transform of the row list (filter, sort, group) |
| `createState`    | reactive state exposed on `grid.state[id]`                       |
| `createApi`      | imperative methods merged into `grid.api`                        |
| `keybindings`    | keyboard bindings, with a `when` guard                           |
| `menuItems`      | column- and context-menu entries                                 |
| `cellDecoration` | per-cell classes and `aria-selected`                             |

`cellDecoration` runs for every rendered cell, so keep it cheap — a grid whose features do not
define it skips the work entirely:

```ts
const highlightNegative = (): GridFeature<Row> => ({
    id: 'highlight-negative',
    cellDecoration: ({ node, column }) =>
        column.id === 'balance' && node.row.balance < 0 ? { class: 'text-error' } : undefined
})
```

### DOM contract

Body cells carry `data-dg-cell="rowIndex:colIndex"` (absolute indices within the
filtered/sorted set) and rows carry `data-dg-row-id`. Both are public: delegate pointer events
from a wrapper and read them with `event.target.closest('[data-dg-cell]')` rather than
attaching a handler per cell.

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
