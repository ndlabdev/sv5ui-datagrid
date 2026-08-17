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
  <a href="#quick-start"><strong>Quick start</strong></a> &middot;
  <a href="https://github.com/ndlabdev/sv5ui-datagrid/blob/main/CHANGELOG.md"><strong>Changelog</strong></a> &middot;
  <a href="https://github.com/ndlabdev/sv5ui-datagrid/issues"><strong>Issues</strong></a>
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

### Icons

Every icon the grid draws is bundled and registered into Iconify's store, so
neither the grid nor the network is involved at render time. Nothing to
configure: importing the grid registers them, before anything on the page
draws. If your own UI happens to use one of the same icons, it resolves
locally too.

`registerDataGridIcons` is exported for the one case the import does not
cover — a grid behind a dynamic `import()`, where your own icons may render
before the grid's module is even fetched:

```svelte
<!-- src/routes/+layout.svelte -->
<script>
    import { registerDataGridIcons } from '@sv5ui/datagrid'
    registerDataGridIcons()
</script>
```

It is idempotent.

The set covers what the grid itself draws. Icons you hand it — `RowAction.icon`,
a `menuItems` entry, `typeOptions.trueIcon`, anything inside a `cell` snippet —
are yours to bundle, as is any icon of your own the grid never uses:

```ts
import { addCollection } from '@iconify/svelte'
addCollection({ prefix: 'lucide', icons: { rocket: { body: '<path …/>' } } })
```

`datagridIcons` is exported too, if you want to read the shape or merge it.

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

Call a factory inside the `features` array, as above, and `TRow` is inferred
from the array's own type. A factory held in a variable first has nothing to
infer from and resolves to `GridFeature<unknown>`, so spell the argument out
there: `const sort = sorting<Person>()`.

Read a feature's state back with the matching accessor:

```ts
import { getSelection, getSorting } from '@sv5ui/datagrid'

getSelection(grid)?.selectedIds
getSorting(grid)?.setSort([{ columnId: 'name', direction: 'asc' }])
```

The accessor is the typed path: it narrows to the feature's own class, generic
in `TRow`, with nothing optional about what it returns. `grid.api` is the flat
alternative — every feature's methods in one bag, each one optional, because
the grid that has `setPage` is the one that registered `pagination()`:

```ts
grid.api.setPage?.(2) // present only with pagination()
grid.api.getState() // the kernel's own, always there
```

A feature declares its methods by augmenting `GridApi` from
`@sv5ui/datagrid`, which is what the built-in features do:

```ts
declare module '@sv5ui/datagrid' {
    interface GridApi {
        highlightNegative?: (columnId: string) => void
    }
}
```

## Extension points

A feature is a plain object. The built-in features use nothing that is not
available to yours.

| Hook             | What it does                                                     |
| ---------------- | ---------------------------------------------------------------- |
| `pipelineStage`  | an ordered, pure transform of the row list (filter, sort, group) |
| `createState`    | reactive state exposed on `grid.state[id]`                       |
| `createApi`      | imperative methods merged into `grid.api` (see below)            |
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
a 0 to 1 ratio unless you set `wholePercent`. Either way its filter panel and
chips speak percentages, so a cell reading 5% is found by typing 5; what the
filter stores is what the row holds, `0.05` for a ratio column and `5` for a
whole one, so a persisted filter and a server request keep the row's own
units. A `cell` snippet always wins over
`type`, so a column can graduate to a custom renderer without changing anything
else.

Declaring both is the way to decorate without losing the formatting. The
snippet is handed `formatted`, the text the built-in renderer would have
printed, so it never restates the column's own `typeOptions`:

```svelte
{
    id: 'budget',
    type: 'currency',
    typeOptions: { currency: 'USD' },
    cell: budgetCell
}

{#snippet budgetCell({ value, formatted }: DataGridCellContext<Row>)}
    {formatted}
    {#if Number(value) > 300_000}
        <Badge label="high" color="warning" size="xs" />
    {/if}
{/snippet}
```

`formatted` is `undefined` where the built-in rendering is a widget rather than
text — `boolean`, `badge`, `user`, `progress`, `rating`, `link`, `actions` —
because there is no string standing for one. It is computed only if the snippet
reads it. The snippet also receives `column`, so a renderer can reach its own
`def`, alignment or id; `cellClass`, `tooltip`, `colSpan` and `rowSpan` receive
it too.

### Tooltips

`tooltip: true` shows the text the cell is showing, through sv5ui's `Tooltip` —
the design system's, not the browser's `title`. A function takes its place when
the text should say more; it receives the cell context, `formatted` included:

```ts
{ id: 'score', type: 'number', tooltip: ({ row, value }) => `${row.name}: ${value}/100` }
```

The trigger wraps the cell, so hovering anywhere in it opens the tooltip, and it
is taken out of the tab order: the grid is one tab stop, and a page of rows must
not become a page of them. A blank cell gets no tooltip at all.

Text the column never asked to explain is a separate matter: a cell whose
content is clipped gets a plain `title` on hover, measured only when hovered,
because wrapping every cell in the grid is not affordable. `tooltip: false`
turns that off for a column that manages its own.

Null, undefined and empty string all render as an em dash, whatever the
column's `type` and whether it declares one at all. `typeOptions.emptyText`
overrides the text per column — not to be confused with the `emptyText` prop on
`<DataGrid>`, which is the message for a grid with no rows at all. A `cell`
snippet owns its own output, `formatted` included: blanks arrive there already
turned into that text.

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
import {
    getFiltering,
    getPagination,
    getSorting,
    toFilterRequest,
    toSortRequest
} from '@sv5ui/datagrid'

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

let inFlight = 0

async function fetchPage() {
    const ticket = ++inFlight
    const { rows, total } = await api.load({
        filter: toFilterRequest(
            getFiltering(grid)!.model,
            grid.columns.visible.map((column) => column.id)
        ),
        sort: toSortRequest(getSorting(grid)!.sort, grid.columns.defs, getSorting(grid)!.nulls)
    })
    // Typing into the quick filter sends a request per keystroke, and they do
    // not come back in the order they left. Without this the grid ends up
    // showing the answer to a question the user has already moved on from.
    if (ticket !== inFlight) return
    grid.data = rows
    getPagination(grid)!.setRowCount(total)
}
```

The events fire after the feature has settled, which is what makes reading the
state inside the handler safe: `pageChanged` reports the page the grid moved
to rather than the one that was asked for, and a sort or a filter has already
reset the page to 1 by the time it reaches you. `setRowCount` pulls the page
back inside a list that shrank, and a selection survives `data` being replaced,
so a row picked on page 1 is still picked when the user returns to it.

### What your backend has to agree with

The request carries everything the grid decided, and your backend decides the
rest. Under `rowModel: 'server'` the grid does not filter or sort what it is
handed, so where the two disagree, what the reader sees is yours:

| The grid means                                                  | A database's default                 |
| --------------------------------------------------------------- | ------------------------------------ |
| Text compares case-insensitively unless `caseSensitive` is set  | `LIKE` is case-sensitive in Postgres |
| Text orders naturally, so `Item 2` precedes `Item 10`           | `Item 10` precedes `Item 2`          |
| Blank is `null`, `undefined` or `''`                            | `IS NULL` misses `''`                |
| `between` includes both ends                                    | varies                               |
| A date condition means a calendar day, in the reader's own zone | a timestamp in the database's zone   |
| A `percent` column holds the ratio, so 5% travels as `0.05`     | whatever the column stores           |

`nulls` rides on every sort entry, written as the side blanks actually land on,
so `ORDER BY … NULLS LAST` reproduces it without further thought. `quickFields`
names the columns a bare query applies to, which is otherwise unguessable.

Two things the request cannot carry, because they are functions: a column's
`sortFn` and a filter's custom `predicate` run on the client only. Under a
server row model they are never called, and the request describes the built-in
meaning of the condition instead.

`src/tests/server-contract.test.ts` is a backend written against this table.
It answers what the client answers, and it is the shortest description of what
conformance costs.

`toFilterRequest` and `toSortRequest` produce normalized wire shapes, kept
deliberately separate from the internal models: the models answer to the UI and
change with it, while these answer to your backend and grow only by adding a
field a backend could not otherwise know, the way `nulls` and `quickFields`
were added. A column's `sortField` is what travels, so an id that is a UI
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
- The whole keyboard surface, and every binding a feature adds is listed with
  the feature that adds it:

    | Keys                                      | What they do                                                                    |
    | ----------------------------------------- | ------------------------------------------------------------------------------- |
    | Arrows, `Home`/`End`, `PageUp`/`PageDown` | Move the focused cell                                                           |
    | `Ctrl+Home`/`Ctrl+End`                    | First and last cell of the grid                                                 |
    | `Enter` on a header                       | Cycle that column's sort                                                        |
    | `Shift+Enter` on a header                 | Add the column to a multi-sort                                                  |
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
| Scroll, median frame | 19ms      | 23ms      | 35ms    |

The DOM node count is the number worth reading: it is the same at a million
rows as at a hundred thousand, because only the visible window is rendered. The
heap is your data, not the grid's overhead.

Sorting and filtering are measured separately, by `pnpm bench`, because they
are arithmetic rather than rendering and a browser adds noise to them. 100k
rows, four columns, best of ten:

| Operation                     | Time  |
| ----------------------------- | ----- |
| Sort by number                | 18ms  |
| Sort by string                | 265ms |
| Multi-sort, string and number | 264ms |
| Quick filter, per keystroke   | 6ms   |
| Build row nodes               | 2ms   |

A string sort is slower than a numeric one by an order of magnitude and stays
that way: most of it is `Intl.Collator`, which is what makes `Item 2` sort
before `Item 10`, and the grid does not trade that away for speed.

### Known limits

- **Scrolling holds 60fps to roughly half a million rows** and falls to about
  28fps at a million with this many columns. Fewer columns move that line out.
- **Quick filter pays for its first keystroke and reuses it after.** The first
  pass is O(rows x visible columns) on the main thread and formats every cell,
  since the filter matches what a cell draws rather than the value behind it.
  Each keystroke after that is one substring test per row against text already
  built. Measured on the bench at a million rows across four columns: 2.5s for
  the first keystroke, 180ms for each one after, at roughly 7MB of held text
  per 100k rows. Filter on fewer columns, or use `rowModel: 'server'`, where
  that first pass is what matters.

    The text is held against the row object, so it is dropped when a row is
    edited, when `data` is replaced, and when the visible columns or the
    language change.

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
