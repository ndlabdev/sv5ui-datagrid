# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- A setter no longer subscribes its caller to the state it reads on the way
  out. Called from an `$effect`, `setPageSize` used to reset the page the user
  had just turned to, and `toggleSort`, `setColumnFilter` and the column ops
  looped until Svelte stopped them. All seventeen writers now go through
  `mutator`.

### Changed

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

[0.1.0]: https://github.com/ndlabdev/sv5ui-datagrid/releases/tag/v0.1.0
