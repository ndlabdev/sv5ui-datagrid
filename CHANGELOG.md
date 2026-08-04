# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

The Community feature set, built on the feature-module kernel. Not yet
published; entries are grouped for the first `0.x` release.

### Added

- **Kernel** — feature-module system (`GridFeature` extension points: pipeline
  stage, state, api, keybindings, menu items, cell decoration, serialize/
  hydrate), RowNode pipeline, `ColumnModel` with a px/flex/min-max sizing
  engine over CSS variables, `FocusModel` with full keyboard navigation, and a
  div-based ARIA grid (`grid`/`treegrid`).
- **Virtualization** — fixed and variable row virtualizer (Fenwick-tree offset
  cache), column virtualizer, sticky header, `scrollToRow`/`ensureVisible`.
  `getRowHeight` also answers `'auto'`: the row sizes itself to its content and
  is measured back into the scroll offsets, keyed by row id so a measurement
  survives sorting and filtering.
- **Columns** — resize (drag, double-click autosize, keyboard), reorder (drag +
  keyboard), 3-section pinning, visibility chooser, unlimited header groups,
  per-cell spanning via `ColumnDef.colSpan` and `ColumnDef.rowSpan`, and a
  `ColumnDef.headerCell` snippet that draws the header label while `header`
  stays the plain text every non-visual surface reuses.

    A `rowSpan` cell stands in for the rows it covers: they render no cell of
    their own, it carries `aria-rowspan`, and it is the single tab stop for the
    whole run. Spans are resolved against the entire row list rather than the
    rendered window, so scrolling into the middle of one still draws it —
    otherwise its first row leaving the window would take the cell with it.
    Sized from the rows it covers, so it wants uniform row heights rather than
    `getRowHeight: 'auto'`.

    Merging rows takes the horizontal separators away inside a run, so a
    spanning column draws vertical edges instead — without them the merged
    block has no border left at all and reads as a hole rather than a cell. The
    separator at a run's foot stays, since that one belongs to the run below.
    A grid that spans nothing is untouched by any of it.

- **Sorting** — multi-sort with priority badges, per-type comparators with
  configurable null ordering, custom `sortFn`, `sortField` for a column that
  orders by something other than what it shows, and a configurable header cycle
  via `sorting({ cycle })`.
- **Filtering** — quick filter, per-column text / number / date / set / boolean
  filters with a serializable model, filter chips, and custom predicates. Each
  column takes up to two conditions joined with and / or; the negated operators
  (`notContains`, `notEqual`, `notBlank`) and an opt-in `caseSensitive` round
  out the text filter, and `blank` / `notBlank` now reach date columns too.
- **Server requests** — `toFilterRequest` collapses a filter model into
  `FilterRequest`, the normalized shape a server row model sends: every column
  is a list of conditions and a join, whichever shorthand the grid held.
  `toSortRequest` does the same for the sort, in priority order and carrying
  each column's `sortField` — a server has no use for an id that is a UI
  concern. Both wire formats are deliberately separate from the models they
  come from, so they can stay frozen while the client-side ones grow.
- **Selection** — single / multi row selection with a checkbox column,
  select-all, Shift-range, `isRowSelectable`, TSV copy and CSV export. The
  export takes a `delimiter` (`';'` for locales where Excel expects it), an
  explicit `columns` list that may name hidden columns, and a `formatValue`
  callback deciding what each cell becomes on disk.
- **Editing** — cell and row editing with the sv5ui editors, standard-schema
  validation, transactions, undo/redo, and clipboard paste (`Ctrl+V`) filling
  from the focused cell.
- **Row structures** — expansion model, row pinning (top/bottom), full-width
  rows, treegrid ARIA.
- **Row reorder** — `rowReorder()` adds a grip column, `Alt`+`ArrowUp`/
  `ArrowDown` from the keyboard, `isRowDraggable`, an `onReorder` callback and a
  `rowMoved` event. Dragging lifts an opaque copy of the row that follows the
  cursor, dims the one left behind, draws a drop line on the target's edge,
  scrolls when the cursor reaches an edge — the grid's own scroller when it has
  one, the page otherwise — so a row can be moved past what is on screen, which
  matters with virtualization. The copy carries the grid's custom properties
  with it, so its columns and pinned cells keep the geometry they had in the
  list rather than collapsing once it is moved out to `<body>`, and clips them
  to its rounded corners so their square backgrounds cannot eat its outline. It
  follows the cursor on both axes — held to the column it came from it sits
  flush on the list and cannot be told apart from the row under it — while only
  its vertical position decides where the row lands. On release it flies to
  where the row ended up rather than blinking away, and `Escape` abandons the
  move. A mouse has to
  travel a few pixels before a press counts as a drag; a finger has to rest,
  so swiping the grip still scrolls the list and only a hold picks a row up.
  Reordering rewrites `data`, so it is meant for an unsorted grid.
- **Column definitions** — `resizable` freezes one column's width, `tooltip`
  overrides or silences the hover tooltip, and `meta` carries app data the grid
  never reads.
- **Pagination** — client paging plus the server hooks (`rowModel: 'server'`,
  `setRowCount`).
- **State persistence** — versioned JSON snapshots via `getState`/`setState`,
  `persistState` auto-sync to `localStorage` with a `migrate` hook.
- **Toolbar** — quick filter, active filter chips, an export menu, the column
  chooser and the density toggle. The export menu offers every row the filter
  left or just the selection, and takes its file name from `exportFilename`,
  the same prop the right-click menu uses.
- **Theming** — `defineDataGridConfig` app defaults, per-instance `ui` slot
  overrides, and `cellClass` / `rowClass` data-driven callbacks.
- **Localization** — hand the grid the languages it may use and it takes it
  from there: `locales: [enUS, viVN]` and nothing else. It picks from the
  page's own language, `locale` forces a tag, and assigning `grid.locale`
  switches in place — the sort, filter and selection on screen all survive,
  where rebuilding the grid would have lost them.

    A language is one pack: `labels` for the ~60 strings the grid shows, and
    `announcer` for the ones it speaks. Twelve ship from
    `@sv5ui/datagrid/locales` — `en-US`, `vi-VN`, `zh-CN`, `ja-JP`, `ko-KR`,
    `fr-FR`, `de-DE`, `es-ES`, `pt-BR`, `ru-RU`, `id-ID`, `th-TH`. Only the
    packs an app imports are bundled, because the grid cannot reach for a
    language it was never handed; there is deliberately no "all languages"
    export to import by accident. A tag nobody answers for falls back to
    English rather than throwing, and `vi` is answered by `vi-VN` — roughly the
    right language beats the wrong one.

    Every label is typed, so a pack missing a key fails the build rather than
    rendering a blank. Because labels can be functions, a language states its
    own grammar: Russian counts rows through `Intl.PluralRules` (1 строка,
    2 строки, 5 строк), and French and German agree their singular.

    The same tag drives `Intl`, so a number, currency or date column that says
    nothing about locale formats in the grid's language and reformats when the
    language changes. `labels` and `announcer` options still override single
    strings on top of the chosen pack, an operator map one entry at a time.

- **Built-in cell renderers** selected by column `type`: text, number, currency,
  percent, date, datetime, boolean, badge, user, progress, rating, link,
  actions.
- **Icons** bundled locally and registered into Iconify on mount, so the grid
  renders its icons offline instead of fetching them.
- **Demos** — one playground route per feature (basic, columns, filters,
  selection, editing, renderers, rows, reorder, virtual, theming, persistence,
  headless, spans), plus three review routes: `qa` runs every Community feature
  in one grid with live state and loading / error / empty / RTL switches, `i18n`
  switches between the twelve shipped languages in place, and `export` shows the
  exact bytes a CSV export produces.

### Fixed

- **Security** — reject script-bearing `href`s in link cells and neutralize
  spreadsheet formulas in CSV export.
- **Filtering** — anchor the filter panel to its trigger on every open path, and
  stop the grid stealing focus from the panel's inputs.
- **Persistence** — restore synchronously so a client-rendered grid does not
  flash its default layout on reload.
- **Pagination** — show the active page size in the footer select and stack the
  controls cleanly on narrow viewports.
- **Accessibility** — keep the header filter/menu triggers reachable on touch
  devices that cannot hover.
- **RTL** — indent tree and group rows from the inline start, so nesting reads
  correctly under `dir="rtl"` instead of always indenting from the left.
- **Keyboard** — the grid is one tab stop again. Every row's selection checkbox
  was tabbable, so leaving a hundred-row grid took a hundred presses; the
  checkboxes now sit outside the tab order like every other control in the
  grid, and `Space` on the checkbox column's header cell toggles select-all,
  which `Ctrl+A` alone could not undo.
- **Keyboard** — the density control is one tab stop with arrow keys rather
  than three stops in a row, and reports itself as a radio group: it is one
  setting with three values, not three independent toggles.
- **Focus ring** — one treatment across header, body and full-width cells: a
  light inset ring that outranks whatever the grid paints over the cell. The
  controls floating at the end of a header covered its top and bottom edges,
  and the row separator washed out the bottom of every focused body cell, so
  the same ring came out a different weight on each side.
- **Accessibility** — the filler above an ungrouped column no longer reports
  itself as a column header. It names nothing, so it read as an unlabelled
  header to a screen reader; the leaf header below already describes the
  column.
- **Editing** — report undo/redo as edits; blank cells no longer match a numeric
  `between` filter; a shrinking dataset no longer strands the page.
- **Columns** — a long header on a sortable column now truncates with an
  ellipsis and gets the hover tooltip, as unsorted columns already did.
- **Header layout** — the filter and column-menu triggers float over the end of
  the header instead of sitting in its flow. In flow they reserved their width
  even while invisible, so a column under ~130px had nothing left to render its
  label in and showed a single letter or nothing at all.
- **Cell overflow** — cells clip their content, so a badge, avatar or custom
  renderer wider than its column no longer paints over the next one. An open
  editor keeps overflowing on purpose, for its validation message.
- **Filter panel** — the panel renders into `<body>` rather than inside the
  header cell. Inside, it was clipped by the cell's overflow and trapped in the
  stacking context the fading control wrapper opens, so the pinned header cells
  painted over its top edge. It also re-anchors to its trigger while the grid
  or the page scrolls, instead of staying where it was first placed, and now
  sits one layer below the sv5ui popups: sharing their level left the winner to
  DOM order, and the panel — appended last — covered its own operator list.
- **Autosize** — double-click sizing measures the whole header, controls
  included, rather than only its first child. Right-aligned columns measured
  their leading spacer and collapsed to the minimum width. Repeating it is now
  a no-op: content that stretches to the cell (a progress bar, anything on
  `w-full`) is no longer measured as if it had that width, so autosizing twice
  stopped feeding its own result back and creeping the column.
- **Header groups** — a restored snapshot can no longer interleave two groups.
  Dragging already refused to take a column out of its group; `setState` wrote
  the order straight through, and the header then repeated group labels over
  unrelated columns.
- **Filtering** — picking an operator no longer closes the filter panel. The
  listbox is portalled outside the panel, so choosing from it read as a click
  outside; the cell editor already guarded against this and the panel did not.
