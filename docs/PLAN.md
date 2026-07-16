# @sv5ui/datagrid - Master Plan

> Status: living document. Defines the target architecture, feature specification and roadmap
> for building an enterprise-grade data grid on Svelte 5 and sv5ui.

## 1. Vision

Build the most capable data grid in the Svelte ecosystem: feature parity with AG Grid
Community plus the most-used AG Grid Enterprise features (grouping, aggregation, tree data,
server-side row model, range selection), with two advantages no competitor has:

1. **Svelte 5 native.** Runes-based fine-grained reactivity end to end. No adapter layer,
   no VDOM diffing, no wrapper around a framework-agnostic core. Snippets as the rendering
   primitive.
2. **sv5ui ecosystem.** Every auxiliary UI surface (filters, menus, editors, overlays,
   toolbar) is a real sv5ui component, so the grid inherits theming, dark mode, i18n-ready
   icons and accessibility from the design system for free.

Non-goals (for 1.0): pivot mode, integrated charts, Excel-like formula engine,
framework-agnostic core.

### Benchmark targets

| Capability                    | AG Grid Community | TanStack Table | MUI DataGrid Pro | @sv5ui/datagrid 1.0   |
| ----------------------------- | ----------------- | -------------- | ---------------- | --------------------- |
| Row virtualization            | yes               | via addon      | yes              | yes (built-in)        |
| Column virtualization         | yes               | no             | yes              | yes                   |
| Multi-sort / column filters   | yes               | headless only  | yes              | yes                   |
| Column pin / reorder / resize | yes               | headless only  | yes              | yes                   |
| Row grouping + aggregation    | enterprise        | headless only  | premium          | yes                   |
| Tree data                     | enterprise        | headless only  | premium          | yes                   |
| Master / detail               | enterprise        | no             | premium          | yes                   |
| Range selection + clipboard   | enterprise        | no             | premium          | yes                   |
| Inline editing + validation   | yes               | no             | yes              | yes (standard-schema) |
| Server-side row model         | enterprise        | manual         | yes              | yes                   |
| State persistence             | yes               | manual         | yes              | yes                   |
| 100k rows @ 60fps             | yes               | depends        | yes              | yes (budgeted)        |

## 2. Design principles

1. **Headless first.** Every feature works without the UI layer. The `DataGrid` component
   is a thin, replaceable rendering of the core. Power users compose their own UI from the
   same primitives.
2. **Pay for what you use.** Feature modules are tree-shakeable. A grid that only sorts and
   paginates must not carry grouping, editing or clipboard code.
3. **Row-level reactivity, not cell-level.** Reactive granularity is tuned deliberately:
   `$state.raw` for row data, derived windows for rendering, CSS variables for geometry.
   Never a proxy per cell.
4. **The pipeline is pure.** Every data transformation (filter, sort, group, flatten,
   paginate) is a pure, unit-testable function. Runes orchestrate; they do not compute.
5. **ARIA grid spec is not optional.** Keyboard and screen-reader behavior ships in the
   same phase as the feature, never retrofitted.
6. **sv5ui conventions.** `*.types.ts` + `*.variants.ts` per component, tailwind-variants
   slots, `defineConfig` overrides, no comments outside types files.

## 3. Architecture

### 3.1 Layer model

```
┌────────────────────────────────────────────────────────┐
│ components/            UI layer (Svelte + sv5ui)        │
│   DataGrid (batteries-included) + Grid.* compound parts │
├────────────────────────────────────────────────────────┤
│ features/              opt-in feature modules           │
│   sorting filtering selection editing grouping tree     │
│   clipboard export column-ops row-pinning master-detail │
├────────────────────────────────────────────────────────┤
│ core/                  always-on kernel                 │
│   GridState  ColumnModel  RowModel  Virtualizer         │
│   FocusModel  EventBus  GridApi  StatePersistence       │
└────────────────────────────────────────────────────────┘
```

### 3.2 Feature module system

A feature is an object that plugs into well-defined extension points:

```ts
interface GridFeature<TRow> {
    id: string
    /** Ordered transform inserted into the row pipeline. */
    pipelineStage?: PipelineStage<TRow>
    /** Reactive state the feature owns, exposed on grid.state.<id>. */
    createState?: (grid: GridState<TRow>) => unknown
    /** Imperative methods merged into grid.api. */
    createApi?: (grid: GridState<TRow>) => Record<string, unknown>
    /** Keyboard bindings contributed to the focus model. */
    keybindings?: Keybinding<TRow>[]
    /** Column menu / context menu items contributed by the feature. */
    menuItems?: (ctx: MenuContext<TRow>) => MenuItem[]
}
```

`createDataGrid({ features: [sorting(), filtering(), grouping()] })` - unused features are
never imported, so they are never bundled. The batteries-included `<DataGrid>` component
registers a default set; the compound API lets users pick.

### 3.3 Row model pipeline

```
data ($state.raw)
  → filter        (quick filter + per-column + advanced expression)
  → sort          (multi-column, stable, custom comparators)
  → group / tree  (build node hierarchy, compute aggregates)
  → flatten       (respect expanded state → flat render list of RowNode)
  → pin-split     (top-pinned / center / bottom-pinned)
  → window        (pagination page OR virtualizer range)
```

Every stage is a pure function `(rows, state) => rows` memoized with `$derived`. The unit
of the pipeline after the group stage is `RowNode<TRow>` (wraps the raw row with id, depth,
group info, expanded state) so grouping, tree data and master/detail share one node model.

The **server-side row model** swaps the client pipeline for a `DataSource` that receives
the full request descriptor (filter/sort/group/page) and returns rows + counts. The rest of
the grid (rendering, selection, focus) is row-model agnostic.

```ts
interface DataSource<TRow> {
    getRows(request: GetRowsRequest): Promise<GetRowsResult<TRow>>
}

interface GetRowsRequest {
    startRow: number
    endRow: number
    sortModel: SortState[]
    filterModel: FilterModel
    groupKeys: string[]
    groupBy: string[]
}
```

### 3.4 Column model and sizing engine

- Ordered list of `ColumnState` (runtime) derived from `ColumnDef` (user input): order,
  width, flex, pinned side, visibility, group path.
- Multi-level header groups via `children` in defs; leaf columns drive cells.
- Sizing: fixed px, `flex` weights, min/max clamps, auto-size-to-content (measure pass),
  fit-to-viewport. Widths are written to **CSS custom properties on the root element**
  (`--dg-col-<id>-w`); resizing a column updates one CSS variable and re-renders nothing.
- Pinned layout: three horizontal sections (left / center / right) sharing one vertical
  scroller; only the center section scrolls horizontally.

### 3.5 Virtualization engine

Own implementation, tuned for the pinned-sections layout (generic libraries cannot sync
three sections + sticky header + variable heights well).

- **Rows**: windowed rendering with overscan; fixed-height fast path; variable heights via
  a measured-size cache (binary indexed tree for offset lookup); `scrollToRow`,
  `ensureVisible` in the API.
- **Columns**: windowing of center-section leaf columns for wide grids (100+ columns).
- Scroll handling: passive listener → `requestAnimationFrame`-batched range update →
  single `$state` write per frame. Row components are keyed by `RowNode.id` so DOM is
  reused while scrolling.
- Non-virtualized mode remains for small grids and SSR output.

### 3.6 Focus model, events and imperative API

- **FocusModel** owns the active cell (roving tabindex), keyboard dispatch table and
  aria-live announcer. Features contribute keybindings; the model resolves conflicts by
  feature priority.
- **EventBus**: typed events (`rowClick`, `cellFocus`, `sortChanged`, `filterChanged`,
  `selectionChanged`, `editCommit`, `columnResized`, ...) exposed both as component
  callback props and `grid.on(event, handler)`.
- **GridApi**: stable imperative surface - `api.scrollToRow`, `api.exportCsv`,
  `api.applyTransaction({ add, update, remove })`, `api.getState()` / `api.setState()`,
  `api.startEditing(cell)`, `api.selectAll()`, etc. Transactions update `$state.raw` data
  with explicit invalidation, no full re-derive for single-row updates in virtual mode.

### 3.7 Component composition

Two consumption tiers, one implementation:

```svelte
<!-- Tier 1: batteries included -->
<DataGrid {grid} toolbar pagination />

<!-- Tier 2: compound composition (context-connected) -->
<Grid.Root {grid}>
    <Grid.Toolbar>
        <Grid.QuickFilter />
        <Grid.ColumnChooser />
        <Grid.DensityToggle />
        <Grid.Export />
    </Grid.Toolbar>
    <Grid.Header />
    <Grid.Body>
        {#snippet detail({ row })}<OrderDetail {row} />{/snippet}
    </Grid.Body>
    <Grid.StatusBar />
    <Grid.Pagination />
</Grid.Root>
```

`Grid.Root` provides context (`GridState`); every part reads it. `<DataGrid>` is literally
Tier 2 parts assembled with defaults - guaranteeing the compound API never rots.

### 3.8 SSR

First page renders on the server (non-virtualized, first N rows); virtualizer hydrates and
takes over on mount. No `window` access at module scope anywhere in core.

## 4. Feature specification

### 4.1 Columns

- Resize: drag handle on header edge, double-click to auto-size, `api.autoSizeColumns()`,
  keyboard resize (focus header, Shift+Arrow). Live via CSS variables.
- Reorder: pointer drag with drop indicator; `columnOrder` in state; keyboard reorder.
- Pinning: left/right via column menu, drag to edge zone, or `pinned` in def.
- Visibility: column chooser (Popover + Command search + CheckboxGroup) and column menu.
- Header groups: unlimited nesting, group resize distributes to children.
- Spanning: `colSpan(ctx)` / `rowSpan(ctx)` functions on defs (rendered, skipped cells).

### 4.2 Sorting

- Single click cycles asc → desc → none (configurable order); Shift+click appends
  multi-sort with priority badges (sv5ui Chip) in header.
- Per-type default comparators (string/number/date/boolean, locale-aware, nulls
  configurable first/last); custom `sortFn`; `sortField` for server model.

### 4.3 Filtering

- **Quick filter**: toolbar Input, debounced, matches all visible columns.
- **Column filters** (Popover from header icon, filter chips summary in toolbar):
    - text: contains / equals / starts / ends / blank
    - number: = ≠ > ≥ < ≤ between / blank
    - date: equals / before / after / between (sv5ui DatePicker / DateRangePicker)
    - set: distinct-values checklist with search (sv5ui Command + CheckboxGroup)
    - boolean: Select
    - custom: user snippet + predicate
- **Advanced filter builder** (post-1.0 candidate): AND/OR expression tree UI.
- Filter model is serializable (drives persistence and server requests).

### 4.4 Selection

- **Row**: single / multi; checkbox column with header select-all (indeterminate);
  Shift+click range; Ctrl/Cmd+click toggle; `isRowSelectable(row)`.
- **Cell range**: drag or Shift+Arrows to grow a rectangular range; multiple ranges with
  Ctrl; range moves with keyboard; feeds clipboard and status bar aggregates.
- Selection survives sort/filter (keyed by rowId); select-all-matching vs select-page.

### 4.5 Editing

- Triggers: double-click, Enter, F2, type-to-edit; Esc cancels, Enter/Tab commits and
  navigates.
- Built-in editors mapped from column `type`: Input, InputNumber, Textarea (popup),
  Select/SelectMenu, DatePicker, TimeField, Checkbox, Rating, InputTags.
- Custom editor snippet with `{ value, commit, cancel }` contract.
- Validation: column `schema` accepts any standard-schema (zod/valibot/yup/joi - same
  peers as sv5ui Form); invalid commits are blocked with error styling + tooltip.
- Row edit mode (all cells of a row editable, commit/cancel row-level).
- `readonly` / `editable(ctx)` per column and per cell.
- Undo/redo stack over transaction API (Ctrl+Z / Ctrl+Shift+Z).

### 4.6 Row grouping, aggregation, tree data, master/detail

- Group by N columns (API or drag column header to group panel); group rows collapsible,
  sticky group headers optional.
- Aggregations per column: sum / min / max / avg / count / custom `(values, rows) => v`,
  shown in group rows and optional footer row.
- Tree data: `getChildren` or `parentId` adapters; filter modes (keep parents / prune).
- Master/detail: `detail` snippet, lazy render, fixed or auto height, expand column.

### 4.7 Clipboard and export

- Copy cell / range / rows as TSV (Excel-compatible); copy with headers option.
- Paste into editable ranges (fills cells, fires validation per cell).
- Export CSV (core) and XLSX (separate entry `@sv5ui/datagrid/xlsx`, optional dep, so the
  main bundle stays lean).

### 4.8 State persistence

- `api.getState()` returns a versioned, JSON-serializable snapshot: column order/width/
  visibility/pin, sort model, filter model, grouping, page size, density.
- `api.setState(snapshot)` restores; `persistState: { key }` option auto-syncs via
  sv5ui `useLocalStorage`. Migration hook for schema version bumps.

### 4.9 UX surfaces

- **Toolbar**: quick filter, filter chips, column chooser, density (compact/standard/
  comfortable → CSS variable), export menu, custom snippet area.
- **Column menu** (DropdownMenu): sort, pin, autosize, hide, group by.
- **Context menu** (ContextMenu): copy, export selection, custom items via feature API.
- **Status bar**: row counts, selected count, range aggregates (sum/avg/min/max).
- **Overlays**: loading (Skeleton rows on first load, Progress bar on refetch), Empty,
  Error with retry (sv5ui Empty/Error) - all replaceable snippets.
- **Cell UX**: ellipsis + auto Tooltip on truncation.
- RTL: logical properties throughout; verified per phase.

### 4.10 Built-in cell renderers (the sv5ui showcase)

Registered by column `type`, zero config: `text`, `number` (Intl format), `currency`,
`percent`, `date`/`datetime` (@internationalized/date), `boolean` (check icon), `badge`
(Chip with color map), `user` (User: avatar + name), `progress` (Progress), `rating`
(Rating readonly), `link` (Link), `actions` (DropdownMenu of row actions), `sparkline`
(post-1.0). Custom renderers via snippet with `DataGridCellContext`.

## 5. sv5ui component map

| Grid surface        | sv5ui components                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Toolbar             | Input, Chip, Popover, Command, CheckboxGroup, ToggleGroup, DropdownMenu, Button, Kbd                                     |
| Header              | Icon, Chip (sort priority), Tooltip, DropdownMenu (column menu)                                                          |
| Filters             | Input, InputNumber, Select, SelectMenu, DatePicker, DateRangePicker, Command, CheckboxGroup                              |
| Cells               | Chip, User, Progress, Rating, Link, Icon, Tooltip, DropdownMenu                                                          |
| Editors             | Input, InputNumber, Textarea, Select, SelectMenu, DatePicker, TimeField, Checkbox, Rating, InputTags                     |
| Selection           | Checkbox                                                                                                                 |
| Overlays            | Skeleton, Empty, Error, Progress, Toast (async errors)                                                                   |
| Pagination / footer | Pagination, Select (page size)                                                                                           |
| Menus               | ContextMenu, DropdownMenu                                                                                                |
| Hooks               | useResizeObserver, useDebounce, useThrottle, useLocalStorage, useEventListener, useClickOutside, useIntersectionObserver |

Gaps to contribute upstream to sv5ui if needed: none blocking; nice-to-have later:
`useAnnouncer` (aria-live), shared DnD utility.

## 6. Public API sketches

```ts
export interface ColumnDef<TRow> {
    id: string
    header?: string | Snippet<[HeaderContext<TRow>]>
    accessor?: (row: TRow) => unknown
    type?: ColumnType // drives renderer, editor, filter, comparator
    width?: number
    flex?: number
    minWidth?: number
    maxWidth?: number
    align?: 'left' | 'center' | 'right'
    pinned?: 'left' | 'right'
    hidden?: boolean
    resizable?: boolean // default true
    sortable?: boolean
    sortFn?: (a: TRow, b: TRow) => number
    filter?: FilterType | ColumnFilterDef<TRow> | false
    editable?: boolean | ((ctx: CellContext<TRow>) => boolean)
    editor?: EditorType | Snippet<[EditorContext<TRow>]>
    schema?: StandardSchemaV1
    aggregate?: AggregateType | ((values: unknown[], rows: TRow[]) => unknown)
    cell?: Snippet<[CellContext<TRow>]>
    tooltip?: boolean | ((ctx: CellContext<TRow>) => string)
    colSpan?: (ctx: CellContext<TRow>) => number
    children?: ColumnDef<TRow>[] // header group
    meta?: Record<string, unknown>
}

export interface DataGridOptions<TRow> {
    columns: ColumnDef<TRow>[]
    data?: TRow[] // client row model
    dataSource?: DataSource<TRow> // server row model
    getRowId: (row: TRow) => string // required: selection/edit need identity
    features?: GridFeature<TRow>[]
    selection?: SelectionOptions
    editing?: EditingOptions
    grouping?: GroupingOptions
    tree?: TreeOptions<TRow>
    pagination?: PaginationOptions | false
    virtualization?: VirtualizationOptions | false
    persistState?: { key: string; version?: number }
    density?: 'compact' | 'standard' | 'comfortable'
    getRowHeight?: (node: RowNode<TRow>) => number | 'auto'
    isRowSelectable?: (row: TRow) => boolean
    locale?: DataGridLocale
}
```

Full option interfaces live in `core/datagrid.types.ts` and are the contract reviewed at
the start of each phase (RFC-first: types merged before implementation).

## 7. Accessibility specification

- `role="grid"` (`treegrid` when tree/grouping active), `aria-rowcount` / `aria-colcount`
  reflect totals (not the virtual window), `aria-rowindex` / `aria-colindex` per node.
- Roving tabindex: exactly one tabbable cell; grid is one Tab stop.
- Keyboard: Arrows, Home/End, Ctrl+Home/End, PageUp/Down, Space (select), Shift+Space
  (row select), Ctrl+A, Enter/F2 (edit), Esc, Shift+Arrows (range), Alt+ArrowDown (open
  column menu on header), Enter on group row toggles expand (`aria-expanded`).
- `aria-sort` on headers; `aria-selected` on rows/cells; editor announces validation error
  via `aria-invalid` + described-by.
- aria-live announcer for async changes: "sorted by X descending", "35 rows after filter",
  "row 3 selected".
- Every phase lands with axe checks + keyboard interaction tests; a11y acceptance is part
  of feature done-ness.

## 8. Performance strategy and budgets

Budgets (M2-class laptop, Chrome, production build):

| Scenario                                   | Budget                                    |
| ------------------------------------------ | ----------------------------------------- |
| 100k rows × 20 cols, scroll                | 60fps sustained, no dropped-frame streaks |
| 100k rows sort (number)                    | < 150ms to first painted frame            |
| Quick filter keystroke (debounced) on 100k | < 100ms                                   |
| Single-cell transaction update             | no full pipeline re-run; < 5ms            |
| Cold render 1k rows non-virtual            | < 100ms                                   |
| Core bundle (sorting+filter+pagination)    | < 30kb min+gzip excluding sv5ui           |

Tactics: `$state.raw` everywhere data-shaped; pure memoized pipeline; virtual window as
the only rendering driver; CSS variables for all geometry (resize/density/pin offsets);
rAF-batched scroll; keyed DOM reuse; comparator resolution hoisted out of sort loops;
distinct-value caches for set filters; benchmark suite in CI (`pnpm bench`) with
regression alerts against budgets.

## 9. Theming and customization

- One `datagrid.variants.ts` with slots for every visual part (root, toolbar, header,
  headerCell, row, cell, groupRow, detailPanel, statusBar, ...), variants for density,
  striped, bordered, hoverable.
- `defineConfig({ datagrid: { defaultVariants, slots } })` - same global override
  mechanism as every sv5ui component.
- All colors via sv5ui Material 3 tokens; zero hardcoded palette values; dark mode free.
- Per-instance `classes={{ cell: '...', headerCell: '...' }}` escape hatch and
  `cellClass(ctx)` / `rowClass(node)` callbacks.

## 10. Testing strategy

- **Unit (node)**: pipeline stages, column sizing math, virtualizer offset math, filter
  predicates, state snapshot/migration. Property-based tests for sort stability and
  virtualizer invariants (fast-check).
- **Component (vitest browser + playwright, as sv5ui)**: rendering, keyboard nav matrix,
  selection gestures, editing flows, clipboard, menus.
- **A11y**: axe on every demo page; screen-reader smoke scripts for the announcer.
- **Performance**: benchmark suite with fixed datasets, run in CI, asserts §8 budgets.
- **Visual**: playwright screenshots of demo routes (light/dark, LTR/RTL, densities).

## 11. Documentation and demos

Playground route per feature (mirrors sv5ui docs style): basic, sorting, filtering,
selection, editing, grouping, tree, master-detail, virtual-100k, server-side, persistence,
theming, headless (build-your-own-UI recipe). Each demo doubles as a visual-test fixture.

## 12. Roadmap

Each phase ships to npm (0.x), starts with a types-RFC PR, and includes tests + a11y +
docs for its scope. Order optimizes for "credibly advanced" as early as possible.

| Phase                        | Scope                                                                                                                                                                                                                       | Exit criteria                                                            |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **1. Kernel rewrite**        | Feature-module system, RowNode model, ColumnModel + sizing engine (px/flex/min-max, CSS vars), compound `Grid.*` parts + context, FocusModel + full keyboard nav, ARIA grid, overlays, density, toolbar shell, quick filter | keyboard matrix green; axe clean; current MVP re-expressed on new kernel |
| **2. Virtualization**        | Row virtualizer (fixed + variable), column virtualizer, sticky header, scrollTo APIs, SSR-then-hydrate                                                                                                                      | 100k×20 @ 60fps demo; budgets in CI                                      |
| **3. Columns UX**            | Resize, reorder DnD, pinning (3-section layout), visibility chooser, header groups, autosize                                                                                                                                | all column ops keyboard-accessible; state round-trips                    |
| **4. Data ops**              | Multi-sort, all column filter types, filter chips, pagination rework (client), status bar counts                                                                                                                            | filter model serializable; 100k sort/filter within budget                |
| **5. Selection + clipboard** | Row selection, cell range selection, select-all semantics, copy/paste TSV, CSV export, range aggregates in status bar                                                                                                       | Excel round-trip (copy → paste both ways)                                |
| **6. Row structures**        | Grouping + aggregation, tree data, master/detail, row pinning, group panel                                                                                                                                                  | treegrid ARIA; group + virtual scroll compose                            |
| **7. Editing**               | Cell/row editing, all sv5ui editors, standard-schema validation, transactions, undo/redo                                                                                                                                    | edit 100k-row grid without jank; validation UX complete                  |
| **8. Server-side model**     | DataSource, infinite scroll, server sort/filter/group, loading rows, retry/error UX                                                                                                                                         | demo against a real mock API incl. group expand                          |
| **9. 1.0 polish**            | State persistence + migration, XLSX entry, context/column menus complete, RTL audit, locale table, API freeze                                                                                                               | semver 1.0: API review, docs complete, budgets green                     |

Post-1.0 backlog: advanced filter builder, pivot, row reorder DnD, fill handle,
sparkline renderer, print layout, `useAnnouncer` upstream to sv5ui.

## 13. Versioning and process

- 0.x during phases 1-8; breaking changes allowed between minors, always changelogged
  (same CHANGELOG conventions as sv5ui).
- Types-RFC PR opens each phase; implementation PRs reference it.
- Branch model mirrors sv5ui: `dev` integration → `main` release; CI gates
  check/lint/test/bench.

## 14. Risks and mitigations

| Risk                                                    | Mitigation                                                                                                            |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Virtualizer + pinning + grouping interaction complexity | Phase 2 builds virtualizer against RowNode abstraction from day one; phase 6 features flatten into the same node list |
| Reactivity leaks (accidental deep proxies) killing perf | `$state.raw` lint convention; benchmark CI catches regressions                                                        |
| sv5ui breaking changes rippling in                      | UI layer is thin; core has zero sv5ui imports; peer range pinned per release                                          |
| Scope creep before kernel is solid                      | Phase gates: no feature PR ahead of its phase; backlog absorbs ideas                                                  |
| Solo-maintainer bandwidth                               | Each phase independently shippable and pausable; types-first RFCs keep direction cheap to review                      |

## 15. Licensing and monetization

Decision: the grid is a commercial, tiered product. Recommended model: **freemium with a
paid Pro tier** (AG Grid / MUI X model). A fully paid grid with no free tier would get no
adoption in the Svelte ecosystem; the free tier is the marketing channel, the Pro tier is
the revenue. The feature-module architecture (§3.2) exists precisely to make this split
clean.

### 15.1 Tier boundary

| Feature                                             | Community (free, MIT) | Pro (paid, EULA) |
| --------------------------------------------------- | --------------------- | ---------------- |
| Sorting (multi), all column filters, quick filter   | yes                   |                  |
| Pagination (client + server)                        | yes                   |                  |
| Row + column virtualization (100k rows)             | yes                   |                  |
| Column resize / reorder / pin / groups / visibility | yes                   |                  |
| Row selection (single/multi, checkbox)              | yes                   |                  |
| Inline editing + validation, undo/redo              | yes                   |                  |
| CSV export, copy rows                               | yes                   |                  |
| State persistence, theming, density                 | yes                   |                  |
| Row grouping + aggregation, group panel             |                       | yes              |
| Tree data                                           |                       | yes              |
| Master / detail                                     |                       | yes              |
| Cell range selection + Excel-grade clipboard/paste  |                       | yes              |
| Server-side row model (infinite, server group)      |                       | yes              |
| XLSX export                                         |                       | yes              |
| Status bar range aggregates                         |                       | yes              |
| Advanced filter builder, pivot (post-1.0)           |                       | yes              |
| Support                                             | community issues      | priority support |

The boundary mirrors AG Grid Community vs Enterprise - proven to convert: the free tier is
genuinely the best free grid available (virtualization and editing included), the paid
tier is what businesses with data-heavy dashboards cannot live without.

### 15.2 The split, concretely

**Packages**

| Package                    | License | npm                   | Contents                                                                                                   |
| -------------------------- | ------- | --------------------- | ---------------------------------------------------------------------------------------------------------- |
| `@sv5ui/datagrid`          | MIT     | public                | kernel + all Community features + `Grid.*` UI + `DataGrid`                                                 |
| `@sv5ui/datagrid-pro`      | EULA    | public, key-activated | Pro feature modules + Pro UI parts (GroupPanel, StatusBar aggregates, detail renderer) + license validator |
| `@sv5ui/datagrid-pro/xlsx` | EULA    | subpath of pro        | XLSX export (heavy dep isolated, Editor-style optional subpath)                                            |

**Repos and timeline**

| When           | Layout                                                                                                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Now → Phase 4  | one private repo `sv5ui-datagrid` = the Community package only                                                                                                                       |
| Phase 2 ships  | repo flips public (it contains nothing Pro); issues/PRs open                                                                                                                         |
| Phase 5 starts | new **private** repo `sv5ui-datagrid-pro`; depends on `@sv5ui/datagrid` as peer (same relationship datagrid has to sv5ui - the pattern is already proven); local dev via `pnpm link` |

Pro never reaches into Community internals: it consumes only the public `GridFeature`
extension points (§3.2). This keeps the plugin system honest - if Pro cannot build a
feature through it, third parties cannot either, and the extension point gets fixed in
Community first.

**How Pro plugs in (user-visible contract)**

```ts
import { createDataGrid } from '@sv5ui/datagrid'
import { setLicenseKey, grouping, treeData, rangeSelection } from '@sv5ui/datagrid-pro'

setLicenseKey(import.meta.env.VITE_DATAGRID_LICENSE)

const grid = createDataGrid({
    columns,
    dataSource,
    features: [grouping({ by: ['country'] }), treeData(), rangeSelection()]
})
```

No key → features work fully, grid shows a watermark + console notice (free trial by
construction, no separate trial builds).

**Versioning**: lockstep minors - `@sv5ui/datagrid-pro@x.y` requires `@sv5ui/datagrid@^x.y`.
One support matrix row per release, no compatibility grid to maintain.

**Docs**: one public docs/playground site covers both tiers; Pro demos run in watermark
mode and carry a "Pro" badge - the docs site itself is the perpetual live trial.

**Monetization infra** (Phase 5 milestone, all small):

1. `keygen` CLI (private): Ed25519 signing of `{ licensee, seats, type, updatesUntil }`.
2. MoR webhook worker: purchase event → generate key → email. One serverless function.
3. Static pricing page + EULA page on the docs site.

### 15.3 License enforcement

- Offline signed license key (Ed25519): payload = licensee name, seat count, license type,
  updates-until date; signature verified at dev time, no network calls ever.
- Without a valid key: full functionality, plus a visible watermark on the grid and a
  console notice (trial mode). Legal enforcement is the EULA, not DRM.
- Key validity model: **perpetual license + 12 months of updates** (any version published
  while the key is active keeps working forever). Subscriptions only for support renewals.

### 15.4 Sales and payments

- Merchant of record (Paddle / Lemon Squeezy / Polar) - handles global VAT/sales tax and
  payouts, no legal entity per market needed. Checkout → webhook → key generation →
  email delivery; a static pricing page is enough to start.
- Pricing per developer seat, sketch (validate before launch): Single Dev ~$99,
  Team (5 devs) ~$399, unlimited/OEM on request. Renewal (updates + support) at ~50%.

### 15.5 Legal checklist (before first sale)

- EULA for Pro (per-seat grant, no redistribution, no SaaS re-wrapping of the grid itself).
- Replace the repo-wide MIT LICENSE: MIT stays only on the Community package;
  Pro package ships `LICENSE.md` = EULA.
- Trademark hygiene: "sv5ui" naming consistency; npm org `sv5ui` secured before any
  public mention of package names.

### 15.6 Roadmap impact

Phases 1-4 build only Community features - nothing changes. The pro repo and key
infrastructure land at the start of Phase 5 (first Pro features: range selection +
clipboard), so monetization plumbing is not on the critical path of the kernel. Phase 5-8
scopes split accordingly: row selection, TSV copy and CSV export stay in Community;
range selection, paste, grouping, tree, master/detail and the server-side model are built
in the pro repo against the extension points.

## 16. Execution flow A → Z

The single operating checklist. Each stage gates the next; nothing below a gate starts
early except where marked (parallel).

### Stage 0 - Setup (now)

1. Create **private** GitHub repo `ndlabdev/sv5ui-datagrid`; push the scaffold + this plan.
2. CI on `dev` and `main` (check / lint / test), branch model as sv5ui (`dev` → `main`).
3. No npm involvement yet - the package stays repo-only until the public launch; whether
   and when to publish is decided at the Stage 2 gate.

### Stage 1 - Kernel (roadmap phase 1)

5. Types-RFC PR: every core interface (`ColumnDef`, `GridFeature`, `RowNode`, `GridApi`).
6. Kernel rewrite per §3; current MVP re-expressed on it. Internal releases only (tags).

### Stage 2 - Public launch (roadmap phase 2)

7. Virtualization complete, 100k-rows demo, perf budgets in CI.
8. Launch decision gate: register the npm org `sv5ui` (required before the scoped package
   name is mentioned anywhere public), confirm package naming and publish policy.
9. Flip repo public, first `npm publish @sv5ui/datagrid@0.x`, docs/playground site live.
10. Announce (Svelte Discord/Reddit/X). From here: build in public, collect issues.

### Stage 3 - Depth (roadmap phases 3-4)

11. Columns UX, then data ops. Regular 0.x releases: `dev` → PR → `main` → tag →
    `gh release` → `npm publish`.
12. Parallel (business track): draft EULA + pricing page, open Paddle/Lemon Squeezy
    account, build keygen CLI + purchase webhook. Must be done before stage 4 ships.

### Stage 4 - Pro begins (roadmap phases 5-6)

13. Create **private** repo `ndlabdev/sv5ui-datagrid-pro` (peer-depends on Community;
    toolchain copied).
14. Phase 5: row selection / TSV copy / CSV in Community; range selection + paste in Pro.
15. Phase 6: grouping, tree, master/detail in Pro.
16. **Early-bird sales open** once range selection + grouping work: pricing page live,
    checkout → webhook → key → email loop verified end to end with a real purchase.

### Stage 5 - Completion (roadmap phases 7-8)

17. Phase 7 editing (Community). Phase 8 server-side row model (Pro).
18. Lockstep releases: every Community minor is followed by the matching Pro minor.

### Stage 6 - 1.0 (roadmap phase 9)

19. Persistence, XLSX subpath, menus, RTL, locale, API freeze.
20. Launch `@sv5ui/datagrid@1.0` + `@sv5ui/datagrid-pro@1.0`, final pricing replaces
    early-bird, announce.

### Steady state (post-1.0)

- Release loop per repo: `dev` → PR → `main` → tag → GitHub release → npm publish.
- Customer loop: pricing page → MoR checkout → webhook → signed key by email →
  `setLicenseKey()` → watermark off. Renewals extend `updatesUntil`.
- Support loop: Community via public issues; Pro via priority channel (email / private
  issues). Backlog (§12 post-1.0) feeds the next cycle.
