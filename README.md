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
  <a href="https://ko-fi.com/ndlabdev"><img src="https://img.shields.io/badge/Ko--fi-donate-x?style=flat-square&colorA=18181b&colorB=ff3e00&logo=kofi&logoColor=white" alt="donate on Ko-fi" /></a>
</p>

<p align="center">
  <a href="#quick-start"><strong>Quick start</strong></a> &middot;
  <a href="#features-are-modules"><strong>Features</strong></a> &middot;
  <a href="https://github.com/ndlabdev/sv5ui-datagrid/blob/main/CHANGELOG.md"><strong>Changelog</strong></a> &middot;
  <a href="https://github.com/ndlabdev/sv5ui-datagrid/issues"><strong>Issues</strong></a>
</p>

---

Built on [sv5ui](https://github.com/ndlabdev/sv5ui). Register only the features
you use: one a grid does not register is never imported, so its code stays out
of your bundle.

This file is the map. Every option and export carries its own documentation
where you call it, so your editor has the detail on hover, and `pnpm dev` runs
a playground with one page per feature.

## Installation

```bash
pnpm add @sv5ui/datagrid sv5ui
```

```css
/* your Tailwind entry stylesheet */
@import 'sv5ui/theme.css';
@import '@sv5ui/datagrid/theme.css';
```

Tailwind 4 skips `node_modules` when it scans for class names, so each theme
file registers its own compiled output. No `@source` path of your own is
needed. The grid's own file also carries the handful of rules a utility class
cannot express, such as the fade `flashCells()` leaves on a cell; without the
import the grid still works and still marks what changed, it just stops
fading.

| Package      | Version        |
| ------------ | -------------- |
| SvelteKit    | 2.x            |
| Svelte       | 5.x            |
| Tailwind CSS | 4.x            |
| sv5ui        | 2.7.0 or later |

SvelteKit is required rather than optional, because sv5ui resolves
`$app/state`. `@iconify/svelte` and `tailwindcss` are peer dependencies so the
grid and sv5ui share one instance of each.

Icons are bundled and registered on import, so nothing is fetched at render
time and there is nothing to configure. Behind a dynamic `import()`, call
`registerDataGridIcons()` in your layout to register them before your own icons
draw. Icons you hand the grid yourself are yours to bundle.

## Quick start

```svelte
<script lang="ts">
    import { DataGrid, type ColumnDef } from '@sv5ui/datagrid'

    interface Person {
        id: number
        name: string
        age: number
    }

    const columns: ColumnDef<Person>[] = [
        { id: 'name', header: 'Name', sortable: true, filter: 'text', flex: 1 },
        { id: 'age', header: 'Age', sortable: true, align: 'right', width: 100 }
    ]
</script>

<DataGrid data={people} {columns} getRowId={(p) => String(p.id)} pageSize={10} toolbar />
```

That gives you sorting, filtering, column operations and pagination. Use
`createDataGrid` to choose the features, hold the state, or drive the grid from
outside:

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

Call a factory inside the `features` array and `TRow` is inferred. A factory
held in a variable first has nothing to infer from, so spell the argument out
there: `const sort = sorting<Person>()`.

## Features are modules

Nothing is on by default. `createDataGrid` takes the list, and a feature left
out of it is never imported, so it costs nothing:

```ts
features: [sorting(), filtering(), columnOps(), selection(), virtualization()]
```

They group into four kinds: the ordinary table (sorting, filtering, selection,
editing), the shape of the rows (grouping, pivot, tree data, master detail),
the spreadsheet end (formulas, cell ranges, conditional formatting, find and
replace, import and export), and the application end (a server row model, the
same off the main thread, saved views, masking policy). Autocomplete inside
`features: [...]` is the list that cannot go stale, and each factory documents
what it adds where it is declared.

Two things deliberately are not features. `workerDataSource(rows, options)` is
a `DataSource` you hand to `serverRowModel()`, which filters and sorts a
columnar copy off the main thread and falls back to the main one; and the
workbook writer is a pair of functions, `buildGridXlsx` and `createWorkbook`,
on their own entry at `@sv5ui/datagrid/xlsx`, because writing a spreadsheet
involves no grid.

`src/tests/bundle-shape.test.ts` builds a real entry to prove that a feature
you do not register stays out of it.

## Architecture

The package is two layers, either usable on its own. **The headless core:**
`createDataGrid` returns a `GridState` of Svelte 5 runes and a derived row
pipeline, with no DOM and no styling. **The components:** `DataGrid` renders
the whole thing, and the `Grid.*` parts (`Root`, `Viewport`, `Header`, `Body`,
`Toolbar`, `Pagination`, `StatusBar` and others) let you compose the chrome
yourself.

The pipeline is a chain of pure transforms over a `RowNode[]`. Features insert
stages at a declared order, so a stage never has to know what else is
registered.

Three lists of nodes answer three different questions. `grid.nodes` is what is
on screen after paging and virtualization, `grid.preWindowNodes` is everything
the grid would draw, and `grid.filteredNodes` is the list before anything
folded rows away. `grid.totalRows` is the length of the drawn list, which
counts a group header because that is a row you can focus, while
`grid.filteredRowCount` is how many data rows a filter left.

Read a feature's state back through its accessor, which is the typed path, or
through `grid.api`, which is every feature's methods in one flat bag where each
one is optional:

```ts
import { getSelection, getSorting } from '@sv5ui/datagrid'

getSelection(grid)?.selectedIds
getSorting(grid)?.setSort([{ columnId: 'name', direction: 'asc' }])

grid.api.setPage?.(2) // present only with pagination()
grid.api.getState() // the kernel's own, always there
```

## Writing a feature

A feature is a plain object: an `id`, plus any of the optional hooks on
`GridFeature`. The built-in features use nothing that is not available to
yours, and the interface documents each hook where it declares it, so
autocomplete on the object is the list.

Two carry most of the weight. `pipelineStage` is an ordered, pure transform of
the row list, which is how filtering, sorting and grouping are built.
`cellDecoration` is per-cell classes and style:

```ts
const highlightNegative = (): GridFeature<Row> => ({
    id: 'highlight-negative',
    cellDecoration: ({ node, column }) =>
        column.id === 'balance' && node.row.balance < 0 ? { class: 'text-error' } : undefined
})
```

`cellDecoration` runs for every rendered cell, so keep it cheap. It also takes
`style`, a record keyed by CSS property, for a value no class can name. Several
features decorating one cell merge per property, the later one winning, and the
grid's own layout outranks all of them.

`cellValue` decides what a value _is_ on the way out, and covers every way out
at once: the cell and its tooltip, CSV, the clipboard, the text a quick filter
searches, the list a set filter offers, and the draft an editor opens with.
Sorting and filter predicates deliberately stay on the raw value, so take
`sortable` and `filter` off a column you mask. It is a gate on the grid's own
output rather than a security boundary: data that must not reach the browser
should not be sent to it.

A feature declares its own `grid.api` methods by augmenting the `GridApi`
interface, which is what the built-ins do. If you need something unexported in order to build a feature, that is a gap in
the extension points. Open an issue rather than reaching into `dist`.

## Columns

Set `type` and the matching sv5ui component renders the cell, with no snippet
of your own:

```ts
const columns: ColumnDef<Member>[] = [
    { id: 'name', type: 'user', typeOptions: { avatar: (m) => m.avatar } },
    { id: 'team', type: 'badge', typeOptions: { colors: { Core: 'primary' } } },
    { id: 'salary', type: 'currency', typeOptions: { currency: 'EUR' } }
]
```

`ColumnType` is what `type` accepts, running from `text` and `currency`
through `badge`, `progress` and an `actions` menu. Number and date types go
through `Intl`, with formatters cached per configuration because a renderer
runs on every visible cell.

A `cell` snippet always wins over `type`, and declaring both is how to decorate
without losing the formatting: the snippet is handed `formatted`, the text the
built-in renderer would have printed, so it never restates the column's own
`typeOptions`.

`tooltip`, `cellClass`, `colSpan` and `rowSpan` take the same cell context.
`tooltip: true` shows the text the cell is showing, through sv5ui's `Tooltip`
rather than the browser's `title`; a clipped cell gets a plain `title` whether
or not the column asks for one. Blanks render as a dash, overridable per column
with `typeOptions.emptyText`. Row spans resolve against the whole row list
rather than the rendered window, so use them with uniform row heights.

A header group folds when one of its children says what it is for:
`columnGroupShow: 'closed'` marks the summary a closed group folds down to and
`'open'` the detail it puts away. `collapseMode: 'rail'` folds the other way,
the whole group giving way to a narrow drawer with its name down its length,
which needs no summary column. Either way folding is not hiding, and the state
travels in a snapshot. A group's `id` shares a namespace with the columns'.

## Pivot

A pivot reads one long list two ways at once: a field gathered down the page,
another gathered across it, and a measure where the two meet.

```ts
pivot<Sale>({
    rows: ['region'],
    columns: ['quarter'],
    values: [{ field: 'amount', agg: 'sum' }]
})
```

The columns are the part nothing else here does. The grid reads the data, finds
the distinct values of `quarter`, and makes a column for each, so a quarter the
data has not held before arrives as a column with no code changed.
`grouping()` changes how many rows there are; a pivot changes how many columns
there are as well.

**Every total is measured from the rows, never added up from the cells beside
it.** For a sum the two agree. For an average they do not: rows of 100, 80 and
150 cross into averages of 90 and 150, whose own average is 120, while the rows
themselves average 110. One hundred and ten is the answer, and it is what
`totalColumn`, `totalRow`, `columnSubtotal` and every share are built on.

A measure reads as itself or as something else through `showAs`: a share of its
row, its column or the whole, a running total, a change from the crossing
before it, or a rank among the crossings beside it. `per` divides one measure
by another under the same reduction, dividing the two reductions rather than
the rows, which is how a margin is read.

The column axis is ordered by the values themselves, so a number axis counts
and a date axis runs in time; `columnKeys` and `orderColumns` replace that with
an order the application states or one a measure ranks. `maxColumns` refuses
rather than truncates, `keepRows` keeps the largest or smallest few and gathers
the rest into one row measured from itself, and `valuesOn: 'rows'` stops the
measures multiplying the column axis by growing the table downward instead.

A pivot row is a group rather than a row, and the innermost tier never opens
onto the rows it gathered, since every column that would say what those rows
are has been folded away. `rowsBehind(node, columnId)` is where that question
is answered, over the rows a filter left, while `expandAllPivotRows()` and
`collapseAllPivotRows()` work the tiers that do nest.

`Grid.PivotPanel` builds a crossing at run time and adjusts how it reads, the
column menu offers the two axes, `grid.api` carries the same moves, and all of
it is kept in a saved view. On `rowModel: 'server'` the client never crosses
for itself, because a table measured over the blocks a client happens to hold
looks exactly like a correct one: the crossing goes out on every request and
the column axis comes back with the rows.

## Server row model

`rowModel: 'server'` tells the pipeline that `data` already holds exactly what
should be shown, so filtering, sorting and windowing pass their rows through
untouched. The features stay registered, because their state, UI and events are
what a server row model listens to.

```ts
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
    const visibleIds = grid.columns.visible.map((column) => column.id)
    const { rows, total } = await api.load({
        filter: toFilterRequest(getFiltering(grid)!.model, visibleIds),
        sort: toSortRequest(getSorting(grid)!.sort, grid.columns.defs, getSorting(grid)!.nulls)
    })
    grid.data = rows
    getPagination(grid)!.setRowCount(total)
}
```

Events fire after the feature has settled, which is what makes reading the
state inside the handler safe. `toFilterRequest` and `toSortRequest` produce
normalized wire shapes, kept deliberately separate from the internal models so
that your backend answers to one and the UI to the other. Guard the handler
against its own requests: typing into the quick filter sends one per keystroke
and they do not come back in the order they left.

Where the grid's meaning and a database's default disagree, what the reader
sees is yours. The grid compares text case-insensitively, orders it naturally
so `Item 2` precedes `Item 10`, treats `null`, `undefined` and `''` alike as
blank, includes both ends of a `between`, reads a date condition as a calendar
day in the reader's own zone, and sends a `percent` column's own units, so 5%
travels as `0.05`. `src/tests/server-contract.test.ts` is a backend written
against all of it, and the shortest description of what conformance costs.

`exportCsv` writes the rows the grid is holding, which under this model is one
page, so the item is named "Loaded rows" rather than promising the rest. For
the whole set, point `Grid.ExportMenu`'s `onExportAll` at an endpoint that
streams one, built from the same request the grid sends.

## State, localization and theming

```svelte
<DataGrid {grid} persistState={{ key: 'orders-grid' }} />
```

Column layout, sort, filter, page size and density are mirrored into
`localStorage` and restored before the first paint; `grid.api.getState()` and
`setState()` do the same by hand. The snapshot is versioned and JSON
serializable, so it travels to a server or a URL just as well. Columns are
keyed by id, so ids that disappeared are dropped and ids added since keep their
defaults, and `migrate` upgrades snapshots written by an older version of your
app.

> Restoring reads `localStorage`, which the server cannot. Render a persisted
> grid client-side (`export const ssr = false`) to avoid a flash of the default
> layout on reload.

Locale packs ship for a range of languages, and only the ones you import are
bundled. Assigning `grid.locale` switches in place, keeping the
sort, filter and selection on screen, and the same tag drives `Intl`. A pack
says what it has and English answers for the rest, so a pack of five strings
works and one written against an older version keeps working.

Every visual slot is overridable, app-wide through `defineDataGridConfig` or
per grid through the `ui` prop:

```ts
defineDataGridConfig({
    defaultVariants: { density: 'compact' },
    slots: { cell: 'font-mono', headerCell: 'uppercase tracking-wide' }
})
```

Density (`compact`, `standard`, `comfortable`) drives row height and padding
through CSS variables, and the header follows the row height until
`headerHeight` or `groupHeaderHeight` says otherwise. `cellClass` and
`rowClass` cover data-driven styling.

## Accessibility

- A div-based ARIA `grid`, or `treegrid` once rows nest.
- **One tab stop.** Cells carry a roving tabindex and every control inside
  answers through it, so leaving a thousand-row grid takes one press.
- A polite live region announces sorting, filtering, paging, selection, column
  changes and row moves, in the grid's language.
- Layout uses logical properties, so `dir="rtl"` mirrors the grid, pinned
  columns included.
- Every demo route is asserted axe-clean in CI.

The moves a reader reaches for most, which is not the whole surface: a feature
brings its own bindings when you register it, and `commandPalette()` shows at
run time what the registered ones actually bound.

| Keys                                      | What they do                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------- |
| Arrows, `Home`/`End`, `PageUp`/`PageDown` | Move the focused cell                                                           |
| `Ctrl+Home`/`Ctrl+End`                    | First and last cell of the grid                                                 |
| `Enter` / `Shift+Enter` on a header       | Cycle that column's sort, or add it to a multi-sort                             |
| `Space` / `Shift+Space` / `Ctrl+A`        | Select a row, a range, everything on the page                                   |
| `Ctrl+C` / `Ctrl+V`                       | Copy as TSV, paste across cells                                                 |
| `Enter`, `F2`, or any printable key       | Open the editor, seeded with what was typed                                     |
| `Escape`                                  | Close what the editor opened, then the editor                                   |
| `Ctrl`/`Cmd`+`Enter`                      | Commit without leaving the cell, for a textarea or tags field that owns `Enter` |
| `Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y`      | Undo and redo an edit                                                           |
| `Shift+←`/`Shift+→`                       | Resize the focused column                                                       |
| `Alt+←`/`Alt+→`                           | Move the focused column                                                         |
| `Alt+↓` on a header                       | Open the column menu                                                            |
| `Alt+↑`/`Alt+↓` on a row grip             | Move the row                                                                    |
| `←`/`→`/`Enter` on a nested row           | Collapse, expand, or step to the parent                                         |

Paste is bound to the paste event rather than to `Ctrl+V`, so it reads the
clipboard without a permission prompt and covers a right-click paste too.

## Performance

Chromium, 1500x950 viewport, 39 columns of mixed renderers. The `/stress`
playground route is where these come from, so they can be re-run rather than
taken on trust.

|                      | 100k rows | 500k rows | 1M rows |
| -------------------- | --------- | --------- | ------- |
| Data into the grid   | 219ms     | 251ms     | 416ms   |
| JS heap              | 100MB     | 315MB     | 472MB   |
| DOM nodes            | 779       | 779       | 779     |
| Scroll, median frame | 19ms      | 23ms      | 35ms    |

The DOM node count is the number worth reading: the same at a million rows as
at a hundred thousand, because only the visible window is rendered. The heap is
your data, not the grid's overhead.

Sorting and filtering are measured by `pnpm bench` instead, being arithmetic
rather than rendering. 100k rows, four columns, best of ten: 18ms to sort by
number, 265ms by string, 6ms per quick-filter keystroke. A string sort is
slower by an order of magnitude and stays that way, most of it
`Intl.Collator`, which is what makes `Item 2` sort before `Item 10`.

Worth knowing before you scale: a quick filter pays O(rows x visible columns)
on its first keystroke and reuses that text afterwards, so filter on fewer
columns or move to `rowModel: 'server'` at a million rows; tens of thousands of
columns work but are worth measuring for your own widths, the CSS grid template
every row declares being the cost; `getRowHeight: 'auto'` switches the
virtualizer to a Fenwick-tree offset cache, so prefer a fixed height when the
rows allow it; and row reorder rewrites `data`, which an active sort re-sorts
immediately.

## API stability

Everything exported from the package root is public and covered by semver. The
surface is deliberately small: enough to render a grid, enough to write a
feature module, and nothing else. Internal helpers stay unexported and change
freely between releases. Classes the grid constructs for you are exported as
types only; you reach an instance through the grid or a `getX(grid)` accessor.

Three DOM attributes are part of that contract:
`data-dg-cell="rowIndex:colIndex"` and `data-dg-row-id` on the body, and
`data-dg-header-cell="level:firstColumn"` on a header group, which spans
columns and so cannot be named by one. Row indices are absolute within the
filtered and sorted set, and the two rows above the body use negative ones,
`-1` for the leaf header and `-2` for the filter row. Delegate from a wrapper
and read them with `event.target.closest('[data-dg-cell]')` rather than
attaching a handler per cell. Other `data-dg-*` markers are internal structure
and carry no promise.

## Contributing

Issues and pull requests are welcome.

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

The playground under `src/routes` has a page per feature, plus review routes
that run everything in one grid, switch language in place, show the bytes an
export produces, put every editor beside its validation rule, and load up to a
million rows. `qa` and `stress` are the two to reach for first.

## License

[MIT](LICENSE) &copy; [ndlabdev](https://github.com/ndlabdev)
