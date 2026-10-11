# Upgrading to 2.1

Everything in this release is additive at run time: register `pivot()` or
`flashCells()` and they work, leave them out and nothing changes. Two things
touch existing code, and this is both of them.

## `DataGridLabels` gained members again

A crossing brought its own wording, and the label table is one table. If you
hand the grid a subset, which is the usual way, nothing changes:

```ts
createDataGrid({ labels: { search: 'Find...' }, columns, data, getRowId })
```

If you built a complete `DataGridLabels` of your own and passed it as the base
of `mergeLabels`, it no longer type-checks, for the same reason it did not at
2.0. Merge onto the built-in table instead:

```diff
-mergeLabels(overrides, myCompleteTable)
+mergeLabels({ ...myCompleteTable, ...overrides })
```

A locale pack of your own is unaffected: a pack says what it has, and English
answers for the rest, so a pack written against 2.0 keeps working and the new
strings arrive in English until you translate them.

## `stickyGroups` is gone from the shorthand `<DataGrid>`

It type-checked there and did nothing. The shorthand registers no feature that
gives a row a level, so there was never anything to pin, and the prop said
nothing about it. Passing it is now a compile error rather than a silent no-op.

Where it works is beside a feature that shapes the rows:

```diff
-<DataGrid data={rows} {columns} {getRowId} stickyGroups />
+<script lang="ts">
+    const grid = createDataGrid({
+        data: rows,
+        columns,
+        getRowId,
+        stickyGroups: true,
+        features: [virtualization(), grouping({ by: ['desk'] })]
+    })
+</script>
+
+<DataGrid {grid} />
```

It needs `virtualization()`, which is what knows where a row sits against the
scroll, and one of `grouping()`, `tree()` or `pivot()` to give the rows levels.

---

# Upgrading to 2.0

Almost everything in this release is additive: register a feature you did not
have before and it works. Four things are not, and this is all of them.

## `DataGridLabels` gained 147 members

The new features brought their own wording, and the label table is one table.
If you hand the grid a subset, which is the usual way, nothing changes:

```ts
createDataGrid({ labels: { search: 'Find...' }, columns, data, getRowId })
```

If you built a complete `DataGridLabels` of your own and passed it as the base
of `mergeLabels`, it no longer type-checks, because it is now missing 147
members. Merge onto the built-in table instead:

```diff
-mergeLabels(overrides, myCompleteTable)
+mergeLabels({ ...myCompleteTable, ...overrides })
```

## A blank cell now passes `neq` on a number

A text column has always kept a blank on `notEqual`: a cell with no word in it
is not the word being excluded. A number column dropped it, from one guard
applied to every numeric comparator at once. They agree now, and the text
reading is the one that won.

If you were relying on `neq` to exclude blanks, say so:

```diff
 setColumnFilter('score', {
-    kind: 'number', op: 'neq', value: 5
+    kind: 'group',
+    join: 'and',
+    conditions: [
+        { kind: 'number', op: 'neq', value: 5 },
+        { kind: 'number', op: 'notBlank' }
+    ]
 })
```

The server contract's reference implementation in
`src/tests/server-contract-ops.test.ts` shows the same rule, so a server you
wrote against it needs the same change.

## A typed column draws text it cannot parse

A `type: 'number'` column handed `notanumber`, or a `type: 'date'` column
handed `1234-56-78`, used to draw an empty cell. The value was in the row and
the editor opened on it; only the screen said nothing was there. It now falls
back to the raw text, so what the data holds is what you see.

A blank cell is unaffected: `null`, `undefined` and `''` still draw the
column's `emptyText`.

This reaches masking too. A `policy()` rule that substitutes a string into a
typed column used to blank the cell; the mark is drawn now, which is what the
same rule already did on an untyped column.

If you assert on a cell that cannot be parsed, it changed:

```diff
-expect(cell.textContent).toBe('')
+expect(cell.textContent).toBe('notanumber')
```

## The loading skeleton draws cells

A row of skeletons used to be a `role="row"` around plain divs, which a screen
reader cannot read and axe reports. Its cells now carry `role="gridcell"`.

A test asserting that no `gridcell` exists while loading will fail. Assert on
what it meant instead - that no data is on screen:

```diff
-expect(container.querySelectorAll('[role="gridcell"]')).toHaveLength(0)
+const cells = [...container.querySelectorAll('[role="gridcell"]')]
+expect(cells.every((cell) => cell.textContent?.trim() === '')).toBe(true)
```

## Worth knowing, but not breaking

`DateFilterOp` gained `notEqual`. A `switch` of your own over that union is no
longer exhaustive, which TypeScript will point out if you asked it to.

The footer's page range separates the two numbers with a hyphen; it used to use
an en dash. If you snapshot that string, it changed.

A grid's language is set per grid, through `locales` and `locale` on
`createDataGrid`. That has not changed, but it is worth repeating now that
there is far more wording to translate: two grids on one page may speak
different languages, and nothing global has to be put back afterwards.
