# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Sorting reads each column once per row rather than twice per comparison, and
  compares through the branch a single pass over the keys says it needs. A
  column of numbers without blanks can only ever have reached the subtraction
  and one of non-empty strings only the collator, so the ordering is what it
  was. On the bench at 100k rows, best of ten: sorting by number went from
  73ms to 18ms, by string from 386ms to 265ms, and a two-column sort from
  364ms to 264ms. What is left of the string case is mostly `Intl.Collator`,
  which is what puts `Item 2` before `Item 10`.

- The server request carries what a backend cannot guess. `SortRequestEntry`
  gains `nulls`, written as the side blanks actually land on rather than the
  side the option names: a blank sorts as the smallest value here, so `first`
  becomes last once the direction is descending, while SQL's `NULLS FIRST`
  does not move. `FilterRequest` gains `quickFields`, naming the columns a
  bare query string applies to, which the filter model never carried and a
  backend had nothing to work out from. `toSortRequest` takes the nulls
  placement as a third argument, defaulting to the `first` the grid itself
  defaults to; `toFilterRequest` takes the fields as a second, defaulting to
  none, since it cannot see the grid to know which columns are visible. An
  existing call still compiles, and a call that leaves `quickFields` out sends
  an empty list, which a backend should read as a quick filter it has not been
  told how to run. Pass `grid.columns.visible.map((column) => column.id)`.

### Fixed

- A column-virtualized grid stops rendering every column on its first paint.
  Column widths resolve against a container the first paint has not measured
  yet, and with no widths there were no offsets to window by, so the window was
  skipped and every column of every rendered row was drawn until the measure
  landed. On 40 columns that is invisible. Measured in a browser at 100 rows:
  500 columns mounted in 609ms, 2000 in 2.3s, and both drew every cell they
  had. They now mount in 28ms and 37ms, drawing 420 cells either way, and
  20,000 columns mounts in 304ms. `initialColumns` bounds that first paint, the
  way `initialRows` already bounded the row axis, and defaults to 20.

- The column window is searched rather than walked. Finding it stepped from the
  first column every time, so a grid scrolled far to the right paid the whole
  column list on every frame.

- Committing an edit no longer turns the page. `Enter` commits and moves down,
  and on the last row of a page that crossed into the next one: the row just
  edited left the screen and the caret landed somewhere the reader was not
  looking, in answer to a keystroke that meant save. The move now stops at the
  page it started on. Arrow keys still cross it, being a request to go
  somewhere rather than the tail of one to write something, and a virtualized
  grid is untouched, since the row below is there either way.

- A cell editor is not painted over by the line under its own row. The editor
  fills its cell, and the row's separator sits at a layer above it, so one grey
  pixel landed along the bottom of the ring: three edges of one weight and a
  fourth of another. The editor sits above the separator now, and still below
  the pinned columns, which have to stay over anything scrolling beneath them
  whether or not it is being edited.

- Row edit mode draws one line per edge. The row outlines itself, which is
  what it is for, and every field inside outlined itself as well: along the
  seam the two shared that came to four pixels of primary, and on a column
  editing through a `Select` or a date picker it was a third line in the same
  corner, since those draw their own border and their own focus state. A field
  marks focus with a tint and a rule along its lower edge now, which is the
  one edge the row's outline does not already occupy, and a widget editor is
  left to mark its own.

- The export menu stops calling a page all rows. Under `rowModel: 'server'`
  the grid holds one page, and "All rows" wrote that page out under a name
  that promised the whole set: on a grid reporting a million rows it produced
  a file of twenty-five. The item is named "Loaded rows" there now, in all
  twelve languages, and `Grid.ExportMenu` takes an `onExportAll` for the set
  the grid does not hold, which for the row counts a server model exists for
  means an endpoint that streams the file rather than a browser building it.
  A client row model is unchanged: it holds every row the filter left, so
  "All rows" was always true there.

- A `date` column orders its rows as dates whatever form each one arrived in.
  Values were compared like with like, so as soon as one row held a `Date` and
  the next an ISO string the column fell through to comparing text, and June
  came before January. An API makes the mixture easy: some rows through a JSON
  reviver, the rest still strings.

- A set filter matches a column of `Date` objects, and survives a snapshot.
  The value list keyed its entries with `String(value)` while the predicate
  compared entries against cells by identity, so the two never met and the
  filter selected nothing at all. Both sides now key through one function, and
  it keys a `Date` by its instant rather than by `String(date)`, which carried
  the reader's timezone into a persisted filter and stopped matching in
  another one.

- A date filter finds rows in a column of epoch numbers, which `Date.parse`
  reads as no date at all.

- A date editor opens on the date its cell is showing. It read the value as
  `String(value).slice(0, 10)`, which is `2024-01-10` for a stored ISO string
  and `Wed Jan 10` for a `Date` object, so a column holding real dates opened
  an empty picker and committing it wrote the emptiness back. Epoch numbers
  were as blank. All four forms are read now.

- A column with a `type` stores what that type says, without needing `parse`.
  Text arrives from places that carry no types, the clipboard chief among
  them, so pasting `42` into a number column left the row holding the string
  and every neighbour holding a number. A column declaring `number`, `currency`
  or `percent` now parses text into a number when it is one, and leaves it
  alone for validation to refuse when it is not. A `parse` of your own still
  wins, and an editor that already hands back a number is unaffected.

- The quick filter searches what the cells draw. It compared the value behind
  the cell, so no column with a `type` could be found by what was on screen: a
  cell reading `1,234.5` answered only to `1234.5`, one reading `5%` only to
  `0.05`, and one holding a `Date` answered to nothing anybody would type, its
  value being `Wed Jan 10 2024 00:00:00 GMT+0700 (Indochina Time)`. Both forms
  now match, so a search that worked before still works.

    It also got faster. The text a row is searched by is built once and held
    against the row object, which an edit replaces rather than writes through,
    so nothing has to invalidate it. On the bench at 100k rows it went from
    29ms per keystroke to 6ms; at a million rows the first keystroke costs
    about 2.5s and each one after about 180ms, for roughly 7MB of held text
    per 100k rows.

- An export writes a date as a date. A cell holding a `Date` was written with
  `toISOString`, which is the UTC instant and so the previous day wherever the
  clock is ahead of Greenwich, and a column holding epoch numbers left as
  numbers. Both are now written in the calendar the cell was drawn in:
  `2024-01-10` for a `date` column and `2024-01-10T09:30:00` for a `datetime`
  one. This applies to the unformatted export and to clipboard copy; passing
  `formatted` or a `formatValue` of your own is unchanged.

- A `date` column is filtered by the day it draws. Two things had pulled apart
  from what the cell shows, and both of them only outside UTC, which is why the
  suite never saw either. A cell holding a `Date` object was compared by its
  instant rather than its day, so anywhere the clock runs ahead of Greenwich a
  row reading 10 January went unfound by a filter asking for 10 January. And a
  cell holding a plain `2026-03-14` was read as UTC midnight and drawn in local
  time, so from New York it drew 13 March, a day the value does not say.

    Both now resolve to the calendar day the cell is drawn on, and a plain date
    is taken as the day it spells wherever it is read. A timestamp is filtered
    by its local day, so one late enough to have turned over belongs to the day
    the grid shows it on. An app running in UTC sees no change at all. Dates
    that cannot mean a day, `2026-02-30` among them, are refused rather than
    rolled forward into March.

- A `percent` column can be filtered by the percentage it draws. The renderer
  holds a ratio and multiplies by 100 to draw it, so a cell reading `5%` holds
  `0.05`, and the number filter was compiled against the row: typing the 5 that
  was on screen matched nothing, and nothing in the panel said why. The panel
  now collects and reads back percentages, the value list and the chips are
  written the way the cells are, and `%` sits in the inputs so the unit is not
  something to work out.

    What is stored is unchanged: the filter model, snapshots and the request
    `toFilterRequest` builds stay in the units the rows are in, so a filter
    written by an older version still means what it meant. A column setting
    `wholePercent` already held what it drew and is untouched, as is every
    other column type.

## [1.1.0] - 2026-08-13

### Fixed

- `toSortRequest` finds a column that lives under a header group. The lookup was
  a flat `find` over the defs it was handed, and a grid with header groups keeps
  groups at the top level and the real columns in their `children`, so every
  entry matched nothing and was dropped. A server-model grid built the way the
  README shows — `toSortRequest(getSorting(grid)!.sort, grid.columns.defs)` —
  sent an empty sort: the header arrow moved, `sortChanged` fired, the request
  went out, and the rows came back in the order they left, with no error or
  warning to say why.

    The builder flattens now, so passing `columns.defs` works with or without
    groups and the caller cannot get it wrong. A sort naming a column the grid
    genuinely does not have is still dropped, as documented.

- `ui.headerCell` typography reaches a sortable column's label. The classes were
  on the cell — `uppercase` and `text-primary` both in its class list — but a
  sortable column wraps its label in the `<button>` that toggles the sort, and a
  button refuses `text-transform` and `text-align` from its parent by user-agent
  rule. Tailwind's preflight resets `color` and `letter-spacing` on form
  elements and not those two, so a themed header came out the right colour and
  spacing in the wrong case, which read as `ui` half working.

    The sort button is transparent to both now. The test that covered this
    asserted the class was in the class list, which it always was; the new one
    reads the computed style of the label.

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

### Changed

- `tooltip: true` shows what the cell shows, through sv5ui's `Tooltip`. It
  returned the raw value behind the cell — a currency column reading
  `$204,000.00` had a tooltip saying `204000`, a date reading `Aug 11, 2026`
  said `2026-08-11` — and it went out as a native `title`, which the design
  system cannot style. A `tooltip` function is unchanged apart from receiving
  `formatted` alongside the raw `value`.

    The trigger wraps the cell so a hover anywhere in it opens the tooltip, and
    it is taken out of the tab order: bits-ui hands its trigger a `tabindex` of
    0, and the grid is one tab stop. The `tooltipTrigger` slot is new and
    themeable. Mounting 50 rows of two tooltip columns measures 30.9ms against
    11.2ms without, which is the price of a component per cell — `tooltip` is
    opt-in per column, so only the columns asking for one pay it.

    The automatic tooltip for clipped text is untouched: it stays a `title`,
    measured on hover, because it can fire on any cell in the grid.

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

### Fixed

- A row pinned to the bottom draws its separator on the edge facing the rows,
  not on the one facing the grid's own border. Both pinned sections shared a
  rule that put the hairline under every row, which suits the top section —
  where the body is below — and left the bottom section with nothing between it
  and the rows above, plus a rule under its last row sitting on the viewport's
  bottom edge, where it read as a doubled line. The edge is now a `pinSide`
  variant of the `pinnedRow` slot; a `ui.pinnedRow` override still applies to
  both sections.

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

[1.1.0]: https://github.com/ndlabdev/sv5ui-datagrid/releases/tag/v1.1.0
[1.0.0]: https://github.com/ndlabdev/sv5ui-datagrid/releases/tag/v1.0.0
[0.3.0]: https://github.com/ndlabdev/sv5ui-datagrid/releases/tag/v0.3.0
[0.2.0]: https://github.com/ndlabdev/sv5ui-datagrid/releases/tag/v0.2.0
[0.1.0]: https://github.com/ndlabdev/sv5ui-datagrid/releases/tag/v0.1.0
