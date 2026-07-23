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
- **Columns** — resize (drag, double-click autosize, keyboard), reorder (drag +
  keyboard), 3-section pinning, visibility chooser, unlimited header groups, and
  per-cell column spanning via `ColumnDef.colSpan`.
- **Sorting** — multi-sort with priority badges, per-type comparators with
  configurable null ordering, custom `sortFn`, and a configurable header cycle
  via `sorting({ cycle })`.
- **Filtering** — quick filter, per-column text / number / date / set / boolean
  filters with a serializable model, filter chips, and custom predicates.
- **Selection** — single / multi row selection with a checkbox column,
  select-all, Shift-range, `isRowSelectable`, TSV copy and CSV export.
- **Editing** — cell and row editing with the sv5ui editors, standard-schema
  validation, transactions, undo/redo, and clipboard paste (`Ctrl+V`) filling
  from the focused cell.
- **Row structures** — expansion model, row pinning (top/bottom), full-width
  rows, treegrid ARIA.
- **Pagination** — client paging plus the server hooks (`rowModel: 'server'`,
  `setRowCount`).
- **State persistence** — versioned JSON snapshots via `getState`/`setState`,
  `persistState` auto-sync to `localStorage` with a `migrate` hook.
- **Theming** — `defineDataGridConfig` app defaults, per-instance `ui` slot
  overrides, and `cellClass` / `rowClass` data-driven callbacks.
- **Built-in cell renderers** selected by column `type`: text, number, currency,
  percent, date, datetime, boolean, badge, user, progress, rating, link,
  actions.
- **Icons** bundled locally and registered into Iconify on mount, so the grid
  renders its icons offline instead of fetching them.
- **Demos** — one playground route per feature (basic, columns, filters,
  selection, editing, renderers, rows, virtual, theming, persistence, headless).

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
- **Editing** — report undo/redo as edits; blank cells no longer match a numeric
  `between` filter; a shrinking dataset no longer strands the page.
