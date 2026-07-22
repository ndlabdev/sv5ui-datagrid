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

## API stability

Everything exported from the package root is public and covered by semver from 1.0 on. The
surface is deliberately small — enough to render a grid, enough to write a feature module, and
nothing else. Internal helpers (pipeline transforms, filter compilation, undo plumbing, column
sizing maths, scroll normalisation) stay unexported and change freely between releases.

If you need something that is not exported to build a feature, that is a gap in the extension
points — open an issue rather than reaching into `dist`, and the extension point gets fixed.

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
| `serialize`      | the feature's slice of a state snapshot                          |
| `hydrate`        | restores what `serialize` produced                               |

`cellDecoration` runs for every rendered cell, so keep it cheap — a grid whose features do not
define it skips the work entirely:

```ts
const highlightNegative = (): GridFeature<Row> => ({
    id: 'highlight-negative',
    cellDecoration: ({ node, column }) =>
        column.id === 'balance' && node.row.balance < 0 ? { class: 'text-error' } : undefined
})
```

### Built-in cell renderers

Set `type` on a column and the matching sv5ui component renders it — no snippet needed:

```ts
const columns: ColumnDef<Member>[] = [
    { id: 'name', type: 'user', typeOptions: { avatar: (m) => m.avatar } },
    { id: 'team', type: 'badge', typeOptions: { colors: { Core: 'primary' } } },
    { id: 'salary', type: 'currency', typeOptions: { currency: 'EUR', locale: 'de-DE' } },
    {
        id: 'actions',
        type: 'actions',
        typeOptions: { actions: (m) => [{ label: 'Edit', onSelect: edit }] }
    }
]
```

`text`, `number`, `currency`, `percent`, `date`, `datetime`, `boolean`, `badge`, `user`,
`progress`, `rating`, `link`, `actions`. Number and date types go through `Intl`, with the
formatters cached per configuration because a renderer runs on every visible cell. `percent`
expects a 0-1 ratio unless you set `wholePercent`. Null, undefined and empty string render as
`—`, overridable with `emptyText`.

A `cell` snippet always wins over `type`, so a column can start with a built-in renderer and
graduate to a custom one without changing anything else.

### State persistence

`persistState` mirrors column layout, sort, filter, page size and density into `localStorage`
and restores them on mount:

```svelte
<DataGrid {grid} persistState={{ key: 'orders-grid' }} />
```

`grid.api.getState()` and `grid.api.setState(snapshot)` do the same thing by hand — the
snapshot is versioned and JSON-serializable, so it travels to a server or a URL just as well.
Columns are keyed by id: ids that disappeared are dropped and ids added since keep their
defaults, so a stored snapshot never resurrects a column the app no longer defines. Pass
`migrate` to upgrade snapshots written by an older version of your app; anything it declines
falls back to the column defaults rather than half-applying.

A feature persists its own state through `serialize`/`hydrate` and is stored under its id, so
features the kernel knows nothing about round-trip too.

### Server-side paging

Pass `rowCount` and the grid stops slicing, because `data` already holds one page:

```ts
pagination({ pageSize: 25, rowCount: 0 })
// then, as each response lands:
grid.api.setRowCount(total)
```

Page count, the footer range and the status bar all count against the server total. Listen for
`pageChanged` to fetch. Clearing `rowCount` returns to client-side paging.

### RTL

Layout uses logical properties, so a `dir="rtl"` ancestor mirrors the grid — including pinned
columns, which stick to the inline start and end rather than to left and right. Horizontal
scroll positions are normalised through `scrollStart`/`setScrollStart`, since browsers report
`scrollLeft` as negative under RTL.

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
