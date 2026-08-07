<h1 align="center">@sv5ui/datagrid</h1>

<p align="center">
  <strong>A high-performance data grid for Svelte 5.</strong><br/>
  Virtualized past a million rows, keyboard-navigable, and assembled from
  feature modules you can write yourself.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@sv5ui/datagrid"><img src="https://img.shields.io/npm/v/@sv5ui/datagrid?style=flat-square&colorA=18181b&colorB=ff3e00" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/@sv5ui/datagrid"><img src="https://img.shields.io/npm/dm/@sv5ui/datagrid?style=flat-square&colorA=18181b&colorB=ff3e00" alt="npm downloads" /></a>
  <a href="https://github.com/ndlabdev/sv5ui-datagrid/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@sv5ui/datagrid?style=flat-square&colorA=18181b&colorB=ff3e00" alt="license" /></a>
</p>

<p align="center">
  <a href="REPLACE_WITH_DEMO_URL"><strong>Live Demo &amp; Docs</strong></a> &middot;
  <a href="https://github.com/ndlabdev/sv5ui-datagrid/blob/main/CHANGELOG.md"><strong>Changelog</strong></a>
</p>

---

Built on [sv5ui](https://github.com/ndlabdev/sv5ui). Register only the features
you use, and nothing else reaches your bundle.

```svelte
<script lang="ts">
    import { DataGrid, type ColumnDef } from '@sv5ui/datagrid'

    const columns: ColumnDef<Person>[] = [
        { id: 'name', header: 'Name', sortable: true, filter: 'text', flex: 1 },
        { id: 'age', header: 'Age', sortable: true, align: 'right', width: 100 }
    ]
</script>

<DataGrid data={people} {columns} getRowId={(p) => String(p.id)} toolbar />
```

## Contents

- [Features](#features)
- [Installation](#installation)
- [Quick start](#quick-start)
- [Architecture](#architecture)
- [Feature modules](#feature-modules)
- [Extension points](#extension-points)
- [Columns](#columns)
- [Localization](#localization)
- [State persistence](#state-persistence)
- [Server row model](#server-row-model)
- [Theming](#theming)
- [Accessibility](#accessibility)
- [Performance](#performance)
- [DOM contract](#dom-contract)
- [API stability](#api-stability)
- [Contributing](#contributing)

## Features

| Area              | What you get                                                                                                                      |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Rows**          | Row and column virtualization past a million rows, fixed or per-row heights, `'auto'` measured rows, pinned rows, full-width rows |
| **Columns**       | Resize, reorder, pin left/right, hide, nested header groups, autosize, `colSpan` and `rowSpan`                                    |
| **Sorting**       | Multi-sort with priority badges, per-type comparators, null ordering, `sortFn`, `sortField`                                       |
| **Filtering**     | Quick filter plus text, number, date, set and boolean column filters, two conditions per column, chips                            |
| **Selection**     | Single or multi, checkbox column, select-all, Shift-range, TSV copy, CSV export                                                   |
| **Editing**       | Cell and row editing with ten sv5ui editors, schema validation, transactions, undo/redo, clipboard paste                          |
| **Reordering**    | Pointer and keyboard row reorder with an auto-scrolling drag preview                                                              |
| **Persistence**   | Versioned JSON snapshots, `localStorage` auto-sync, `migrate` hook                                                                |
| **Localization**  | Twelve languages, chosen from the page's own; number and date formatting follow                                                   |
| **Accessibility** | ARIA `grid` and `treegrid`, one tab stop, full keyboard navigation, axe-clean                                                     |
| **Server**        | `rowModel: 'server'` with normalized filter and sort requests                                                                     |

Features are opt-in. A feature you do not register is never imported, so its
code stays out of your bundle.

## Installation

```bash
pnpm add @sv5ui/datagrid sv5ui
```

Import both themes in your Tailwind entry stylesheet:

```css
@import 'sv5ui/theme.css';
@import '@sv5ui/datagrid/theme.css';
```

Tailwind 4 skips `node_modules` when it scans for class names, so a package has
to register its own compiled output. Each theme file does that for itself, which
is why no `@source` path of your own is needed.

### Requirements

| Package      | Version        |
| ------------ | -------------- |
| SvelteKit    | 2.x            |
| Svelte       | 5.x            |
| Tailwind CSS | 4.x            |
| sv5ui        | 2.5.0 or later |

SvelteKit is required rather than optional: sv5ui resolves `$app/state`, which
only a SvelteKit app provides. `@iconify/svelte` and `tailwindcss` are declared
as peer dependencies so that the grid and sv5ui share a single instance of
each; package managers that install peers automatically (pnpm 8+, npm 7+)
resolve them for you.

## Quick start

```svelte
<script lang="ts">
    import { DataGrid, type ColumnDef } from '@sv5ui/datagrid'

    interface Person {
        id: number
        name: string
        age: number
    }

    const people: Person[] = [/* ... */]

    const columns: ColumnDef<Person>[] = [
        { id: 'name', header: 'Name', sortable: true, filter: 'text', flex: 1 },
        { id: 'age', header: 'Age', sortable: true, align: 'right', width: 100 }
    ]
</script>

<DataGrid data={people} {columns} getRowId={(p) => String(p.id)} pageSize={10} toolbar />
```

That gives you sorting, filtering, column operations and pagination.

Use `createDataGrid` when you want to choose the features, hold the state, or
drive the grid from outside:

```svelte
<script lang="ts">
    import {
        createDataGrid,
        DataGrid,
        columnOps,
        filtering,
        selection,
        sorting,
        virtualization
    } from '@sv5ui/datagrid'

    const grid = createDataGrid({
        data: people,
        columns,
        getRowId: (p) => String(p.id),
        features: [sorting(), filtering(), columnOps(), selection(), virtualization()]
    })
</script>

<DataGrid {grid} toolbar class="h-[640px]" />
```

## Architecture

The package is two layers, either usable on its own.

**Headless core.** `createDataGrid` returns a `GridState`: Svelte 5 runes and a
derived row pipeline of `filter`, `sort` and `window`. No DOM, no styling.

**Components.** `DataGrid` renders the whole thing. The `Grid.*` parts
(`Root`, `Viewport`, `Header`, `Body`, `Toolbar`, `Pagination`, `StatusBar` and
others) let you compose the chrome yourself.

The pipeline is a chain of pure transforms over a `RowNode[]`. Features insert
stages at a declared order, so a stage never has to know what else is
registered.

## Feature modules

| Feature            | Adds                                           |
| ------------------ | ---------------------------------------------- |
| `sorting()`        | Multi-sort, header cycle, priority badges      |
| `filtering()`      | Quick filter, column filters, filter chips     |
| `columnOps()`      | Resize, reorder, pin, hide, autosize           |
| `selection()`      | Checkbox column, copy, CSV export              |
| `editing()`        | Cell/row editing, validation, undo/redo, paste |
| `pagination()`     | Client paging and the server hooks             |
| `virtualization()` | Row and column virtualization                  |
| `rowPinning()`     | Rows pinned to the top or bottom               |
| `rowReorder()`     | Drag grip and keyboard reorder                 |

Read a feature's state back with the matching accessor:

```ts
import { getSelection, getSorting } from '@sv5ui/datagrid'

getSelection(grid)?.selectedIds
getSorting(grid)?.setSort([{ columnId: 'name', direction: 'asc' }])
```

## Extension points

A feature is a plain object. The built-in features use nothing that is not
available to yours.

| Hook             | What it does                                                     |
| ---------------- | ---------------------------------------------------------------- |
| `pipelineStage`  | an ordered, pure transform of the row list (filter, sort, group) |
| `createState`    | reactive state exposed on `grid.state[id]`                       |
| `createApi`      | imperative methods merged into `grid.api`                        |
| `keybindings`    | keyboard bindings, with a `when` guard                           |
| `menuItems`      | column and context menu entries                                  |
| `cellDecoration` | per-cell classes and `aria-selected`                             |
| `serialize`      | the feature's slice of a state snapshot                          |
| `hydrate`        | restores what `serialize` produced                               |

```ts
const highlightNegative = (): GridFeature<Row> => ({
    id: 'highlight-negative',
    cellDecoration: ({ node, column }) =>
        column.id === 'balance' && node.row.balance < 0 ? { class: 'text-error' } : undefined
})
```

`cellDecoration` runs for every rendered cell, so keep it cheap. A grid whose
features do not define it skips the work entirely.

## Columns

### Built-in renderers

Set `type` and the matching sv5ui component renders the cell, with no snippet
of your own:

```ts
const columns: ColumnDef<Member>[] = [
    { id: 'name', type: 'user', typeOptions: { avatar: (m) => m.avatar } },
    { id: 'team', type: 'badge', typeOptions: { colors: { Core: 'primary' } } },
    { id: 'salary', type: 'currency', typeOptions: { currency: 'EUR' } },
    {
        id: 'actions',
        type: 'actions',
        typeOptions: { actions: (m) => [{ label: 'Edit', onSelect: edit }] }
    }
]
```

Available types: `text`, `number`, `currency`, `percent`, `date`, `datetime`,
`boolean`, `badge`, `user`, `progress`, `rating`, `link`, `actions`.

Number and date types go through `Intl`, with formatters cached per
configuration because a renderer runs on every visible cell. `percent` expects
a 0 to 1 ratio unless you set `wholePercent`. Null, undefined and empty string
render as `DEFAULT_EMPTY_TEXT`, which `emptyText` overrides per column. A `cell`
snippet always wins over `type`, so a column can graduate to a custom renderer
without changing anything else.

### Spanning

`colSpan(ctx)` and `rowSpan(ctx)` return how many cells to merge from the
current one. Covered cells are not rendered, the merged cell carries
`aria-colspan` and `aria-rowspan`, and it is the single tab stop for the block.

```ts
{ id: 'region', rowSpan: (ctx) => runLengthAt(ctx.rowIndex) }
```

Row spans are resolved against the whole row list rather than the rendered
window, so scrolling into the middle of one still draws it. They are sized from
the rows they cover, so use them with uniform row heights rather than `'auto'`.

## Localization

Hand the grid the languages it may use. It picks one from the page's own
language, so nothing else needs configuring:

```ts
import { enUS, jaJP, viVN } from '@sv5ui/datagrid/locales'

createDataGrid({ columns, data, getRowId, locales: [enUS, viVN, jaJP] })
```

Twelve packs ship: `en-US`, `vi-VN`, `zh-CN`, `ja-JP`, `ko-KR`, `fr-FR`,
`de-DE`, `es-ES`, `pt-BR`, `ru-RU`, `id-ID`, `th-TH`. Only what you import is
bundled.

- `locale` forces a tag. Assigning `grid.locale` switches in place, keeping the
  sort, filter and selection on screen.
- The same tag drives `Intl`, so number, currency and date columns that name no
  locale of their own follow the grid and reformat with it.
- A tag nobody answers for falls back to English. `vi` is answered by `vi-VN`.
- `labels` and `announcer` override single strings on top of the chosen pack.

A pack is `{ tag, labels, announcer }` and every key is typed, so writing your
own language fails the build rather than rendering a blank.

## State persistence

```svelte
<DataGrid {grid} persistState={{ key: 'orders-grid' }} />
```

Column layout, sort, filter, page size and density are mirrored into
`localStorage` and restored before the first paint. `grid.api.getState()` and
`grid.api.setState(snapshot)` do the same by hand. The snapshot is versioned and
JSON-serializable, so it travels to a server or a URL just as well.

Columns are keyed by id: ids that disappeared are dropped, ids added since keep
their defaults. Pass `migrate` to upgrade snapshots written by an older version
of your app. Anything it declines falls back to the column defaults rather than
half-applying. Features persist their own slice through `serialize` and
`hydrate`.

> Restoring reads `localStorage`, which the server cannot. Render a persisted
> grid client-side (`export const ssr = false`) to avoid a flash of the default
> layout on reload.

## Server row model

`rowModel: 'server'` tells the pipeline that `data` already holds exactly what
should be shown: filtering, sorting and windowing pass their rows through
untouched. The features stay registered, because their state, UI and events are
what a server row model listens to.

```ts
import { toFilterRequest, toSortRequest } from '@sv5ui/datagrid'

const grid = createDataGrid({
    columns,
    data: [],
    getRowId,
    rowModel: 'server',
    features: [sorting(), filtering(), pagination({ pageSize: 25 })]
})

for (const event of ['sortChanged', 'filterChanged', 'pageChanged'] as const) {
    grid.events.on(event, fetchPage)
}

async function fetchPage() {
    const { rows, total } = await api.load({
        filter: toFilterRequest(grid.api.getFilterModel()),
        sort: toSortRequest(getSorting(grid)!.sort, grid.columns.defs)
    })
    grid.data = rows
    grid.api.setRowCount(total)
}
```

`toFilterRequest` and `toSortRequest` produce normalized wire shapes, kept
deliberately separate from the internal models so they can stay frozen while
those grow. A column's `sortField` is what travels, so an id that is a UI
concern need not be one your database recognizes.

## Theming

Every visual slot is overridable, app-wide or per grid:

```ts
import { defineDataGridConfig } from '@sv5ui/datagrid'

defineDataGridConfig({
    defaultVariants: { density: 'compact' },
    slots: { cell: 'font-mono', headerCell: 'uppercase tracking-wide' }
})
```

```svelte
<DataGrid {grid} ui={{ row: 'even:bg-surface-container-lowest' }} />
```

`cellClass` and `rowClass` cover data-driven styling. Density (`compact`,
`standard`, `comfortable`) drives row height and padding through CSS variables.

## Accessibility

- A div-based ARIA `grid`, or `treegrid` once rows nest.
- **One tab stop.** Cells carry a roving tabindex and every control inside
  answers through it, so leaving a thousand-row grid takes one press.
- Arrows, `Home`/`End`, `PageUp`/`PageDown`, `Ctrl+Home`/`Ctrl+End`, `Space`,
  `Enter`, `Escape`, `Ctrl+A`, `Ctrl+C`, `Ctrl+V`, and `Alt+Arrow` for moving
  columns and rows. In an editor, `Ctrl`/`Cmd`+`Enter` commits without leaving
  the cell, which is the way out of a textarea or tags field that owns `Enter`.
- A polite live region announces sorting, filtering, paging, selection, column
  changes and row moves, in the grid's language.
- Layout uses logical properties, so `dir="rtl"` mirrors the grid, pinned
  columns included. Horizontal scroll is normalized through `scrollStart` and
  `setScrollStart`, since browsers report `scrollLeft` as negative under RTL.
- Every demo route is asserted axe-clean in CI.

## Performance

Measured on Chromium at a 1500x950 viewport, 39 columns of mixed renderers
(currency, percent, date, badge, progress, rating, boolean). The playground
route `/stress` is where these come from, so they can be re-run rather than
taken on trust.

|                      | 100k rows | 500k rows | 1M rows |
| -------------------- | --------- | --------- | ------- |
| Data into the grid   | 219ms     | 251ms     | 416ms   |
| JS heap              | 100MB     | 315MB     | 472MB   |
| DOM nodes            | 779       | 779       | 779     |
| Sort                 | 81ms      | 67ms      | 67ms    |
| Scroll, median frame | 19ms      | 23ms      | 35ms    |
| Quick filter         | 0.5s      | 1.1s      | 2.1s    |

The DOM node count is the number worth reading: it is the same at a million
rows as at a hundred thousand, because only the visible window is rendered. The
heap is your data, not the grid's overhead.

### Known limits

- **Scrolling holds 60fps to roughly half a million rows** and falls to about
  28fps at a million with this many columns. Fewer columns move that line out.
- **Quick filter is O(rows x visible columns) on the main thread.** At a million
  rows and 39 columns that is 39 million string comparisons and about two
  seconds of blocked UI. Filter on fewer columns, or use `rowModel: 'server'`,
  until this is made incremental.
- **Beyond the browser's maximum element height** the scroll range is scaled
  rather than clamped, so the last row stays reachable; a pixel of scrolling
  simply covers more than a pixel of content. Engines differ on where that
  starts (Chromium at 2^25px, others lower), so the grid caps below the lowest
  in wide use.
- **`getRowHeight: 'auto'`** switches the virtualizer to a Fenwick-tree offset
  cache, which is O(log n) per lookup rather than the fixed path's arithmetic.
  Prefer a fixed height when the rows allow it.
- **Row reorder rewrites `data`**, so an active sort re-sorts it immediately.
  Clear the sort before offering the grip.

## DOM contract

Body cells carry `data-dg-cell="rowIndex:colIndex"`, holding absolute indices
within the filtered and sorted set, and rows carry `data-dg-row-id`. Both are
public: delegate pointer events from a wrapper and read them with
`event.target.closest('[data-dg-cell]')` rather than attaching a handler per
cell.

## API stability

Everything exported from the package root is public and covered by semver from
1.0 on. The surface is deliberately small: enough to render a grid, enough to
write a feature module, and nothing else. Internal helpers such as pipeline
transforms, filter compilation, undo plumbing, column sizing maths and scroll
normalization stay unexported and change freely between releases.

Classes the grid constructs for you are exported as types only. You reach an
instance through the grid or a `getX(grid)` accessor.

If you need something unexported in order to build a feature, that is a gap in
the extension points. Open an issue rather than reaching into `dist`, and the
extension point gets fixed.

## Contributing

Issues and pull requests are welcome. To run the project locally:

```bash
git clone https://github.com/ndlabdev/sv5ui-datagrid.git
cd sv5ui-datagrid
pnpm install
pnpm dev        # playground at localhost:5173
pnpm test       # vitest (unit + browser)
pnpm check      # svelte-check
pnpm lint       # prettier + eslint
pnpm build      # package + publint
```

The playground under `src/routes` has one page per feature, plus review routes:
`qa` runs everything in one grid, `i18n` switches language in place, `export`
shows the bytes a CSV export produces, `spans` exercises cell spanning against a
pinned column, `editors` puts every editor beside its validation rule, and
`stress` loads up to a million rows across 39 columns.

## License

[MIT](LICENSE) &copy; [ndlabdev](https://github.com/ndlabdev)
