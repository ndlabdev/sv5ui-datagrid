# 2.1.0

Pivot tables, a mark on a cell whose value just moved, and the group a reader
is inside kept under the header. Everything here is opt-in: register the
feature or leave it out.

One type-level break, in a minor on purpose: `DataGridLabels` gains required
members, so an application that builds its own complete table and hands it to
`mergeLabels` as the base no longer compiles. Nothing at run time changes.
[MIGRATING.md](https://github.com/ndlabdev/sv5ui-datagrid/blob/main/MIGRATING.md)
has the two lines that fix it.

## Added

- `pivot()`: one field down the page by another across it, with the columns
  read from the data and every total measured from the rows
- Seven readings of a measure, a column axis you can order or trim, and the
  measures stacked on either axis
- `Grid.PivotPanel` to build a crossing at run time, and the whole crossing in
  a saved view
- A crossing on `rowModel: 'server'`, carried as a normalized request
- `flashCells()`: a cell says when its value changed, fading over its own
  clock, restyled through a slot, two custom properties or an `appearance` hook
- `stickyGroups`: the group rows a reader is inside pinned under the header
- `headerHeight` and `groupHeaderHeight`, counted per tier
- `GridFeature.columns`, the extension point a crossing needed, so a feature
  can add columns an application never declared
- A formatting rule can name a pivot measure instead of a column id

## Fixed

Eighteen, among them a pinned cell going transparent on a grand total row, a
server grid keeping the answer to the crossing before, and a saved view that
could turn a feature on but never off.

Every change, and why, is in
[CHANGELOG.md](https://github.com/ndlabdev/sv5ui-datagrid/blob/main/CHANGELOG.md).
