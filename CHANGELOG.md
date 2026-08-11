# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Removed

- Twenty-eight symbols leave the package entry. Nothing in this repository —
  no demo, no line of the README, no test importing through the package
  entry — reached for any of them, and a 1.0 surface should carry what an app
  does with the grid rather than what happens to exist inside it. They are
  still there internally; only the public door closed.

    Gone: `datagridVariants`, `getGridContext`, `setGridContext`,
    `GridCellValue`, `DEFAULT_EMPTY_TEXT`, `DEFAULT_CSV_DELIMITER`,
    `HEADER_ROW`, `ROW_HANDLE_COLUMN_ID`, `isSyntheticColumn`, `dataColumns`,
    `downloadCsv`, `neutralizeFormula`, `documentLocale`, `resolveLocale`,
    `defaultAnnouncerStrings`, `filterConditions`, `isFilterGroup`,
    `normalizeFilterEntry`, `DATE_OPS`, `NUMBER_OPS`, `TEXT_OPS`, and the
    `DataGridVariantProps` type.

    What each was for, if you were using one: `typeOptions.emptyText` and the
    `emptyText` prop cover the empty-cell text; `toCsv` takes its delimiter as
    an argument and neutralizes formulas itself; `Grid.Root` sets the context
    that `getGridContext` read; theming goes through the `ui` prop and
    `defineDataGridConfig`, which is what `datagridVariants` bypassed.

    The formatters go with them — `formatCurrency`, `formatDate`,
    `formatNumber`, `formatPercent`, `toDate`, `toNumber`, `isBlank` and
    `FormatOptions` — now that a snippet is handed the formatted text instead
    of the tools to rebuild it. See `formatted` below.

### Added

- `formatted` on `exportCsv` and `copySelection`: writes what the grid is
  showing rather than the value behind it. A user looking at `$204,000.00` and
  `Aug 11, 2026` copied `204000` and `2026-08-11`, and asking for the other one
  meant passing a `formatValue` callback that rebuilt formatting the grid had
  already done.

    Off by default, and deliberately so — a spreadsheet wants a number it can
    sum and a date it can sort. An explicit `formatValue` still wins, and a
    column whose `type` draws a widget has no text of its own, so the raw value
    stands in rather than an empty column.

- A `cell` snippet receives `formatted`: the text the built-in renderer would
  have printed for that value. Declaring `type` and `cell` together is now how
  a column keeps its formatting and decorates around it, rather than the
  snippet restating the column's own `typeOptions` — which is the shape AG Grid
  (`valueFormatted`) and MUI (`formattedValue`) both settled on. It is
  `undefined` where the built-in rendering is a widget rather than text, since
  no string stands for one, and it is computed only if the snippet reads it.
- Every cell callback receives `column`: `cell`, `cellClass`, `tooltip`,
  `colSpan` and `rowSpan`. A renderer that needs its own `def`, alignment or id
  had no way to reach them.
- `src/tests/public-api.test.ts` pins the runtime export list, so the surface
  grows or shrinks by decision rather than by accident. The blanket
  `export type *` over `core/types` had been publishing every type added there
  without anyone choosing to.

### Changed

- The entry file is three lines. Each area names its own exports —
  `core/index.ts`, `components/index.ts`, `features/index.ts` — one by one
  rather than re-exporting modules wholesale, so nothing reaches an app
  because it happened to be added to a folder. Nothing moved for a consumer:
  the same names come from `@sv5ui/datagrid` as before.

## [1.0.0] - 2026-08-10

### Added

- `rowCountChanged` on the event bus, emitted by `setRowCount` under
  `rowModel: 'server'` when the total it is given differs from the one before.
  It is the moment a server model learns how many rows it has, and the
  announcer now says the count there rather than counting the page.
- `registerDataGridIcons` and `datagridIcons` are exported. Nothing needs to
  call the registrar now that the import covers it, except a grid behind a
  dynamic `import()` whose module may load after the app's own icons render.
  It is idempotent.

### Changed

- Select-all adds the rows in view to the selection instead of replacing the
  selection with them, and clearing it takes those rows back out rather than
  emptying the lot. The header checkbox already reported on the rows the grid
  holds, so under `rowModel: 'server'` pressing it on page 2 dropped everything
  chosen on page 1, and under a filter it dropped the rows the filter hid.
  `clear()` still empties the selection, and `selectAll()` on an unfiltered
  client grid still selects every row.

### Fixed

- `setQuickFilter` from app code survives the toolbar. The quick filter box
  owned both directions of the sync in one effect: a call from outside woke it
  on `filtering.quick`, and it wrote the box's own value back over the call in
  the same flush, so a saved view, a deep link or a "clear all" button was a
  silent no-op wherever `<DataGrid toolbar />` was used. The box now pushes
  only what it produced, and mirrors a filter set from code instead of fighting
  it — so the text in it matches the filter in force, which it did not before.
- A grid on `rowModel: 'server'` stays on the page it is showing. Focusing a
  body cell turned to the page the focused row sits on, arithmetic that only
  holds when the grid holds the whole dataset — a server model holds one page,
  so its rows are indexed 0..n whichever page they came from and every click
  past page 1 snapped back to page 1 and fetched it. Selecting, editing,
  opening a cell menu and arrowing down off the page were all caught by it.
  Filtering and sorting already stood aside for a server model; paging now does
  too.
- A server model numbers its rows from the page it holds. The row index in a
  cell descriptor was offset by the page, so past page 1 every lookup into
  `preWindowNodes` pointed past the end of an array holding one page: `Space`
  selected the last row of the page rather than the focused one, `Ctrl+C` and
  type-to-edit reached nothing, and `aria-rowindex` ran past the
  `aria-rowcount` the grid reports. A client model, which holds the whole set,
  still offsets by the page.
- A server model tells a screen reader where in the whole set the page sits.
  `aria-rowcount` counted the rows the grid held — one page — and
  `aria-rowindex` counted from 1 within it, so every page read as "row 1 of
  10". The count is now the server's total and the index is offset by the
  page, which is what a client grid with pagination already reported.
- The announcer no longer counts the page after a filter under a server model.
  It said "10 rows" for a filter the server answered with 46, and said it
  before the request had even gone out; it now speaks on `rowCountChanged`.
- A click anywhere in the selection column toggles its row. The checkbox is
  18x18 inside a 44x40 cell, so 18% of the column was live and the rest looked
  identical and did nothing; the whole cell is now the target, in the header
  select-all as well as the rows. Shift still extends a range from the cell,
  and a row `isRowSelectable` rules out stays inert wherever it is clicked.
- The bundled icons register when the grid is imported rather than when a grid
  mounts. `Grid.Root` registered them from its instance script, so anything the
  app drew first — its own button carrying `lucide:copy`, an icon the grid
  already ships — found an empty store and fetched it, and the icon flickered
  in when the response landed. The call moves to the component's module script,
  which runs at import, before any render. This is where sv5ui registers its
  own bundle, for the same reason.

    Reproduced against a fresh SvelteKit app with the published tarball, built
    and served: the page asked for `?icons=copy,rocket` before, and only
    `rocket` after — an icon of the app's own that the grid never bundles.

## [0.3.0] - 2026-08-09

### Fixed

- `editing({ mode: 'row' })` now decides what a gesture opens. The option was
  stored and never read, so a double-click, `Enter` and `F2` opened a single
  cell whatever it said, and a row edit could only be reached from app code
  through `startRowEdit`. They all route through the new `beginEdit`, which
  honours the mode; `startEdit` and `startRowEdit` still ask for one shape by
  name and ignore it.
- A click on a field inside a row edit reaches that field. The cell carries a
  roving tabindex and the focus model pulled focus back onto it, so the
  keystrokes went nowhere and only `Tab` could get into a field.
- Opening a row edit puts the caret in its first editable field. Every editor
  mounts at once, and the last one to run used to keep the focus — the eye
  started at the first field while the caret sat in the last.
- A row edit no longer drops every select list open at once, which buried the
  rows beneath it. A cell edit still opens its list, which is what it is for.
- The announcer counts in the singular where the language has one. It said
  "1 rows selected", "1 rows copied" and "1 rows" after a filter. The same
  fault was in German, Spanish, French and Brazilian Portuguese, and the last
  three inflect the participle too, so "1 filas seleccionadas" needed the whole
  phrase rather than the noun alone. Forms come from `Intl.PluralRules`, not a
  `count === 1` branch: French and Portuguese read zero as singular, and
  Russian — already correct — needs three forms. The languages with no
  grammatical number are unchanged.
- The bundled icon set no longer guesses which fallbacks sv5ui needs from it.
  A hand-written list had named `loader-2`, which nothing renders, while sv5ui
  asks for `loader-circle`; it also restated three pagination chevrons sv5ui
  already ships. sv5ui registers its own defaults before the grid renders, so
  the generator now takes only what sv5ui leaves uncovered — today nothing.
  35 icons ship instead of 39, and none of them is dead.

### Changed

- A row edit draws one ring around the row rather than one per field. Each
  editor used to draw its own inset ring, so every seam between two fields read
  as a single doubled rule and the cells holding a widget editor drew no box at
  all — a row of loose boxes rather than one surface. Fields are now separated
  by a hairline, and a field shows a ring of its own only while it has focus.
  The `rowEditing`, `cellEditorInRow` and `cellEditorInRowDivider` slots are new
  and themeable.

## [0.2.0] - 2026-08-08

Six issues found while writing the documentation pages against 0.1.0. Two of
them change behaviour, so this is a minor rather than a patch.

### Fixed

- A setter no longer subscribes its caller to the state it reads on the way
  out. Called from an `$effect`, `setPageSize` used to reset the page the user
  had just turned to, and `toggleSort`, `setColumnFilter` and the column ops
  looped until Svelte stopped them. All seventeen writers now go through
  `mutator`.
- A `rowSpan` on the first visible column no longer draws a start edge over the
  viewport's own border, which read as a doubled rule down the grid's left side.
- A column that declares no `type` now shows the empty text for a blank, like
  every other column. It used to print the raw value, so a hole rendered as
  nothing at all and `typeOptions.emptyText` was never consulted.

### Changed

- `grid.api` has a type. It was `Record<string, unknown>`, so every member read
  back as `unknown` and calling one was an error — including the README's own
  server row model example. It is now `GridApi`: the kernel's `getState` and
  `setState` are always there, and each feature declares its own methods by
  augmenting the interface from its module, which is what a feature you write
  now does too. Contributed methods are optional, so calls through the flat bag
  need `?.`; `getPagination(grid)` and friends stay the typed path.
- Blank means null, undefined or the empty string everywhere. Sorting used to
  collate `''` among the values while the renderers and the `blank` filter
  operator called it empty, so `nulls: 'last'` did nothing for a column whose
  holes were empty strings. Set filters likewise fold `''` into the single null
  entry rather than offering a second, identical-looking one.

    A column that means something by `''` and relied on it sorting as a value
    needs a `sortFn` to keep the old order.

## [0.1.0] - 2026-08-07

The first release. Everything below is new, so it is grouped by area rather
than listed as a diff against a version nobody has.

### Kernel

- Feature-module system. A feature is a plain object plugging into
  `pipelineStage`, `createState`, `createApi`, `keybindings`, `menuItems`,
  `cellDecoration`, `serialize` and `hydrate` — the same hooks the built-in
  features use, so nothing the package ships needs privileged access.
- Row pipeline of pure transforms over `RowNode[]`, ordered by declaration so a
  stage never has to know what else is registered.
- `ColumnModel` with a px / flex / min-max sizing engine driven by CSS
  variables, and `FocusModel` with full keyboard navigation.
- Div-based ARIA `grid`, or `treegrid` once rows nest.

### Rows and columns

- Row and column virtualization: fixed heights on a fast path, per-row heights
  and `'auto'` on a Fenwick-tree offset cache. An `'auto'` row is measured back
  into the scroll offsets, keyed by row id so the measurement survives sorting.
- `scrollToRow` and `ensureVisible`.
- A list taller than the browser will render still reaches its last row.
  Engines clamp an element's height, so at 40px a million rows want 40M px and
  the last 160k used to be unreachable by scrolling; past the limit the spacer
  is scaled and scroll positions map through it. A list the browser can render
  at full height takes the same path it always did.
- Column resize (drag, double-click autosize, keyboard), reorder (drag and
  keyboard), three-section pinning, a visibility chooser and nested header
  groups.
- Cell spanning through `colSpan(ctx)` and `rowSpan(ctx)`. Covered cells are not
  rendered, the merged cell carries `aria-colspan` / `aria-rowspan`, and it is
  the single tab stop for the block. Row spans resolve against the whole row
  list, so scrolling into the middle of one still draws it; they are sized from
  the rows they cover and want uniform row heights rather than `'auto'`.
- `headerCell` draws the header label while `header` stays the plain text every
  non-visual surface reuses. `resizable` freezes a column's width, `tooltip`
  overrides or silences the hover tooltip, and `meta` carries app data the grid
  never reads.
- Expansion model, row pinning to top and bottom, full-width rows.
- Row reorder: a grip column, `Alt`+`ArrowUp`/`ArrowDown`, `isRowDraggable`, an
  `onReorder` callback and a `rowMoved` event. Dragging lifts a copy of the row
  that follows the cursor and auto-scrolls at the edges — the grid's own
  scroller when it has one, the page otherwise — so a row can be moved past
  what is on screen. Reordering rewrites `data`, so it is meant for an unsorted
  grid.

### Data operations

- Multi-sort with priority badges, per-type comparators, configurable null
  ordering, custom `sortFn`, `sortField` for a column that orders by something
  other than what it shows, and a configurable header cycle.
- Quick filter plus text, number, date, set and boolean column filters, with a
  serializable model, filter chips and custom predicates. Each column takes up
  to two conditions joined with and / or, and the text filter carries the
  negated operators and an opt-in `caseSensitive`.
- Single and multi row selection with a checkbox column, select-all,
  Shift-range and `isRowSelectable`. TSV copy, and CSV export taking a
  `delimiter`, an explicit `columns` list that may name hidden columns, and a
  `formatValue` callback.
- Cell and row editing with the sv5ui editors, standard-schema validation,
  transactions, undo/redo and clipboard paste from the focused cell.
- Opening an editor hands it the keyboard: a select drops its list open, a
  date lands on its first segment, a text field selects what is there. Typing
  a printable key on a focused cell opens the editor on that character, for
  the editors that can hold one.
- `Enter` commits where the editor does not claim it, `Tab` commits and moves
  on, and `Ctrl`/`Cmd`+`Enter` commits without leaving the cell — the way out
  of a textarea or a tags field, which own `Enter` for a newline and a tag.
- Client pagination, plus the server hooks `rowModel: 'server'` and
  `setRowCount`.
- `toFilterRequest` and `toSortRequest` produce normalized wire shapes for a
  server row model, kept separate from the internal models so they can stay
  frozen while those grow.
- Versioned JSON state snapshots through `getState` / `setState`, with
  `persistState` mirroring column layout, sort, filter, page size and density
  into `localStorage` and a `migrate` hook for older snapshots.

### Presentation

- Thirteen built-in cell renderers selected by column `type`: `text`, `number`,
  `currency`, `percent`, `date`, `datetime`, `boolean`, `badge`, `user`,
  `progress`, `rating`, `link`, `actions`.
- Toolbar with a quick filter, active filter chips, an export menu, the column
  chooser and the density toggle. The export menu offers every row the filter
  left or just the selection; the chooser lists only the columns an app
  declared and scrolls once there are more of them than fit on screen.
- A divider per header column. The resize handle sits on that edge but only
  appears on hover, so the line is what says where a column ends and what can
  be dragged; the body keeps no vertical rules of its own.
- Theming through `defineDataGridConfig` for app-wide defaults, a per-instance
  `ui` prop for slot overrides, and `cellClass` / `rowClass` for data-driven
  styling.
- Loading, empty and error states as replaceable surfaces. The skeleton fills
  the grid rather than showing a fixed few rows, taking its count from what the
  viewport or the page size would have held; `loadingRows` overrides it.
- Icons bundled and registered into Iconify on mount, so a running grid never
  fetches them.

### Localization

- Twelve languages ship from `@sv5ui/datagrid/locales`: `en-US`, `vi-VN`,
  `zh-CN`, `ja-JP`, `ko-KR`, `fr-FR`, `de-DE`, `es-ES`, `pt-BR`, `ru-RU`,
  `id-ID`, `th-TH`. Only what an app imports is bundled.
- The grid picks one from the page's own language; `locale` forces a tag, and
  assigning `grid.locale` switches in place, keeping the sort, filter and
  selection on screen. A tag nobody answers for falls back to English, and `vi`
  is answered by `vi-VN`.
- The same tag drives `Intl`, so number, currency and date columns that name no
  locale of their own follow the grid and reformat with it.
- A pack is `{ tag, labels, announcer }` with every key typed, so a language
  missing one fails the build. Labels can be functions, so a language states
  its own grammar — Russian counts rows through `Intl.PluralRules`.
- `labels` and `announcer` override single strings on top of the chosen pack.

### Fixed

Bugs found and closed before the first release.

- **Security** — reject script-bearing `href`s in link cells; neutralize
  spreadsheet formulas in CSV export.
- **Keyboard** — the grid is one tab stop. Every row's selection checkbox used
  to be tabbable, so leaving a hundred-row grid took a hundred presses; `Space`
  on the header cell now toggles select-all.
- **Keyboard** — the density control is one tab stop answering the arrow keys,
  and reports itself as a radio group rather than three independent toggles.
- **Focus ring** — one treatment across header, body and full-width cells. The
  header's floating controls covered its top and bottom edges and the row
  separator washed out its bottom, so the same ring came out a different weight
  on each side.
- **Accessibility** — the filler above an ungrouped column no longer reports
  itself as an unlabelled column header; keep the header filter and menu
  triggers reachable on touch devices that cannot hover.
- **Header layout** — the filter and column-menu triggers float over the end of
  the header rather than sitting in its flow, where they reserved their width
  even while invisible and left a narrow column nothing to render its label in.
- **Filter panel** — renders into `<body>`, so it is no longer clipped by the
  header cell or trapped under the pinned headers; re-anchors to its trigger
  while the grid or page scrolls; sits one layer below the sv5ui popups, so it
  no longer covers its own operator list; and picking an operator no longer
  reads as a click outside and closes it.
- **Filtering** — blank cells no longer match a numeric `between` filter.
- **Autosize** — measures the whole header including its controls, rather than
  only its first child, which collapsed right-aligned columns to the minimum
  width. Repeating it is now a no-op: content that stretches to the cell is no
  longer measured as if it had that width, so autosizing twice stopped creeping
  the column wider.
- **Cell overflow** — cells clip their content, so a wide badge or avatar no
  longer paints over the next column. An open editor still overflows, for its
  validation message.
- **Header groups** — a restored snapshot can no longer interleave two groups
  and repeat their labels over unrelated columns.
- **Selection** — the checkbox is centred in its column; sv5ui reserves a label
  slot whether or not anything visible goes in it.
- **Persistence** — restores synchronously, so a client-rendered grid does not
  flash its default layout on reload.
- **Pagination** — show the active page size in the footer select; stack the
  controls cleanly on narrow viewports; a shrinking dataset no longer strands
  the page.
- **Editing** — report undo and redo as edits.
- **Columns** — a long header on a sortable column truncates with an ellipsis
  and gets the hover tooltip, as unsorted columns already did.
- **RTL** — indent tree and group rows from the inline start, so nesting reads
  correctly under `dir="rtl"`.

### Known limits

Measured rather than assumed, and stated here so nobody has to discover them
in production. Numbers are Chromium at 39 columns; see the README for the
full table.

- **Quick filter is O(rows x visible columns) on the main thread** — about two
  seconds at a million rows, which blocks the UI. Filter on fewer columns or
  use `rowModel: 'server'` until it is made incremental.
- **Scrolling holds 60fps to roughly half a million rows** and falls to about
  28fps at a million with this many columns.
- **Past the browser's maximum element height the scroll range is scaled**, so
  every row stays reachable but a pixel of scrolling covers more than a pixel
  of content.
- **`rowSpan` resolves against the whole row list**, one pass per spanning
  column on every sort or filter. Fine for the report-shaped data it is for,
  costly at a million rows.
- **`getRowHeight: 'auto'`** puts the virtualizer on its variable-height path;
  a fixed height is cheaper where the rows allow it.
- **Row reorder rewrites `data`**, so an active sort re-sorts it immediately:
  clear the sort before offering the grip.
- **Server row model covers filter, sort and paging.** Grouping, tree data and
  infinite scroll belong to `@sv5ui/datagrid-pro`.

### Development

- A playground route per feature (basic, columns, filters, selection, editing,
  renderers, rows, reorder, virtual, theming, persistence, headless, spans),
  plus five review routes: `qa` runs every feature in one grid with live state
  and loading / error / empty / RTL switches, `i18n` switches between the
  twelve languages in place, `export` shows the exact bytes a CSV export
  produces, `spans` exercises row and column spanning against a pinned column,
  `editors` puts all ten built-in editors next to the validation rule each
  column enforces, and `stress` loads up to a million rows across 39 columns
  and reports what each load cost.
- Performance budgets in CI as coarse regression ceilings, measured best-of-3
  so a loaded machine does not fail a build.

[1.0.0]: https://github.com/ndlabdev/sv5ui-datagrid/releases/tag/v1.0.0
[0.3.0]: https://github.com/ndlabdev/sv5ui-datagrid/releases/tag/v0.3.0
[0.2.0]: https://github.com/ndlabdev/sv5ui-datagrid/releases/tag/v0.2.0
[0.1.0]: https://github.com/ndlabdev/sv5ui-datagrid/releases/tag/v0.1.0
