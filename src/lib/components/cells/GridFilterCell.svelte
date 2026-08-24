<script lang="ts" generics="TRow">
    import { untrack } from 'svelte'
    import {
        Button,
        DatePicker,
        Input,
        InputNumber,
        Select,
        SelectMenu,
        useDebouncedState
    } from 'sv5ui'
    import {
        buildColumnFilter,
        describeFilter,
        filterTypeOf,
        filterUnitScaleOf,
        floatingCellOf,
        getFiltering
    } from '../../features/filtering/index.js'
    import type { SetFilterValue } from '../../core/types/index.js'
    import { formatCellText } from '../../core/utils/index.js'
    import { fromDateValue, toDateValue } from '../internal/editor-values.js'
    import type { GridFilterCellProps } from '../datagrid.types.js'
    import { getGridContext } from '../internal/context.js'
    import { datagridVariants } from '../datagrid.variants.js'
    import { getGridTheme } from '../internal/theme.js'

    let { column, debounce = 200 }: GridFilterCellProps<TRow> = $props()

    const grid = getGridContext<TRow>()
    const filteringState = getFiltering(grid)!
    const slots = datagridVariants()
    const theme = getGridTheme()
    const labels = $derived(grid.labels)

    // ---- What this column's filter needs -----------------------------------

    const type = $derived(filterTypeOf(column.def))
    const scale = $derived(filterUnitScaleOf(column.def))
    const entry = $derived(filteringState.columnFilters[column.id])
    const cell = $derived(floatingCellOf(type, entry, scale))

    /** No steppers: a filter field is not a place to count up from. */
    const numberUi = { increment: 'hidden', decrement: 'hidden' }

    /**
     * The picker takes no `aria-label`; it takes an `id` for a label to point
     * at, which is the way sv5ui means it to be named.
     */
    const dateFieldId = $props.id()

    /** What the panel holds, in the words the chips use for the same filter. */
    const summary = $derived.by(() => {
        if (!entry) return ''
        const written = (value: unknown) =>
            formatCellText(value, column.def, grid.locale) ?? String(value)
        return describeFilter(entry, labels, written)
    })

    const field = useDebouncedState(
        untrack(() => (cell.kind === 'input' ? cell.value : '')),
        untrack(() => debounce)
    )

    /**
     * What the field holds, for the widget that speaks numbers. A value that
     * is not a number at all — a snapshot written by hand, a filter set by an
     * app — reads as no value rather than as `NaN`, which the widget would
     * draw and then hand back.
     */
    const numberValue = $derived.by(() => {
        const raw = String(field.current ?? '')
        if (raw === '') return null
        const parsed = Number(raw)
        return Number.isFinite(parsed) ? parsed : null
    })

    // ---- The typed field: text, number, date -------------------------------

    /** One condition, in the operator the column already filters by. */
    function apply(raw: string): void {
        if (!type || cell.kind !== 'input') return
        filteringState.setColumnFilter(
            column.id,
            buildColumnFilter(
                type,
                {
                    join: 'and',
                    conditions: [{ op: cell.op, value: raw, to: '' }],
                    // Kept, so typing in the row does not quietly undo a Match
                    // case the panel turned on.
                    caseSensitive: cell.caseSensitive,
                    boolValue: 'true',
                    setSelected: []
                },
                scale
            )
        )
    }

    // Pushes what the field produced, and nothing else — the two halves the
    // quick filter box is built from, for the same reason: one effect reading
    // both directions writes the field back over a filter set in code.
    $effect(() => {
        const value = String(field.debounced ?? '')
        untrack(() => {
            if (cell.kind === 'input' && value !== cell.value) apply(value)
        })
    })

    // The other direction: a filter cleared by a chip, set by the panel or
    // restored from a snapshot shows here.
    $effect(() => {
        const value = cell.kind === 'input' ? cell.value : ''
        untrack(() => {
            if (value !== String(field.debounced ?? '')) field.setImmediate(value)
        })
    })

    // ---- The choice: boolean -----------------------------------------------

    /**
     * A choice with no filter on it needs a value of its own. An empty string
     * reads to the select as nothing selected, which drew an empty control
     * with no way back to it.
     */
    const ANY = 'any'
    const asChoice = (value: string) => (value === '' ? ANY : value)

    let choice = $state(untrack(() => asChoice(cell.kind === 'boolean' ? cell.value : '')))

    $effect(() => {
        const value = choice
        untrack(() => {
            if (cell.kind !== 'boolean' || value === asChoice(cell.value)) return
            filteringState.setColumnFilter(
                column.id,
                value === ANY ? null : { kind: 'boolean', value: value === 'true' }
            )
        })
    })

    $effect(() => {
        const value = asChoice(cell.kind === 'boolean' ? cell.value : '')
        untrack(() => {
            if (value !== choice) choice = value
        })
    })

    // ---- The list of ticks: set --------------------------------------------

    /**
     * A set value keyed for a list of strings, without collapsing two values a
     * column may genuinely hold apart: the number 5 and the string `5` are one
     * tick each, and a blank is neither of them.
     */
    function keyOf(value: SetFilterValue): string {
        if (value === null) return 'x:'
        const tag = typeof value === 'number' ? 'n' : typeof value === 'boolean' ? 'b' : 's'
        return `${tag}:${String(value)}`
    }

    /** Order is not part of a set, so it is not part of comparing two. */
    const sameKeys = (a: string[], b: string[]) =>
        a.length === b.length && [...a].sort().join('\u0000') === [...b].sort().join('\u0000')

    /** A value as its own column writes it, and a blank as the panel names it. */
    const shownValue = (value: SetFilterValue) =>
        value === null
            ? labels.blankValue
            : (formatCellText(value, column.def, grid.locale) ?? String(value))

    /**
     * Reading the column's distinct values is a pass over every row the grid
     * holds, so it waits until the list is opened. Until then the ticks are
     * the only entries, which is all the trigger needs to name them.
     */
    let listOpened = $state(false)

    const setValues = $derived.by(() => {
        const ticked = cell.kind === 'set' ? cell.values : []
        if (!listOpened) return ticked
        const offered = filteringState.distinctFor(column.id)
        const known = new Set(offered.map(keyOf))
        // A ticked value the data no longer holds keeps its place in the list.
        return [...offered, ...ticked.filter((value) => !known.has(keyOf(value)))]
    })

    const setItems = $derived(
        setValues.map((value) => ({ value: keyOf(value), label: shownValue(value) }))
    )

    const setField = useDebouncedState<string[]>(
        untrack(() => (cell.kind === 'set' ? cell.values.map(keyOf) : [])),
        untrack(() => debounce)
    )

    $effect(() => {
        const keys = setField.debounced
        untrack(() => {
            if (cell.kind !== 'set' || sameKeys(keys, cell.values.map(keyOf))) return
            const byKey = new Map(setValues.map((value) => [keyOf(value), value]))
            const values = keys
                .map((key) => byKey.get(key))
                .filter((value): value is SetFilterValue => value !== undefined)
            filteringState.setColumnFilter(
                column.id,
                values.length > 0 ? { kind: 'set', values } : null
            )
        })
    })

    $effect(() => {
        const keys = cell.kind === 'set' ? cell.values.map(keyOf) : []
        untrack(() => {
            if (!sameKeys(keys, setField.debounced)) setField.setImmediate(keys)
        })
    })
</script>

{#if cell.kind === 'input' && type === 'number'}
    <InputNumber
        size="xs"
        ui={numberUi}
        locale={grid.locale}
        aria-label={labels.filterRowValue(column.header)}
        class="w-full"
        value={numberValue}
        onValueChange={(next) => (field.current = next === null ? '' : String(next))}
    />
{:else if cell.kind === 'input' && type === 'date'}
    <!-- Through the same debounced field as the other two, and reading back
         from it rather than from the model. A segmented field reports every
         keystroke: typing 01/05/2026 walks through the years 2, 20 and 202,
         and each of those would otherwise be a filter over the whole set.
         Reading the model back would also fight the typing, since what it
         holds during that walk is a year the person has already moved past. -->
    <label class="sr-only" for={dateFieldId}>{labels.filterRowValue(column.header)}</label>
    <DatePicker
        id={dateFieldId}
        size="xs"
        class="w-full"
        locale={grid.locale}
        value={toDateValue(field.current)}
        onValueChange={(next) => (field.current = fromDateValue(next))}
    />
    {#if String(field.current ?? '') !== ''}
        <!-- A picker has no clear of its own. Immediate, not debounced: this
             is a finished gesture, not a value half typed. -->
        <Button
            variant="ghost"
            size="xs"
            icon="lucide:x"
            tabindex={-1}
            aria-label={labels.removeFilter(column.header)}
            onclick={() => field.setImmediate('')}
        />
    {/if}
{:else if cell.kind === 'input'}
    <Input
        size="xs"
        placeholder={labels.valuePlaceholder}
        aria-label={labels.filterRowValue(column.header)}
        class="w-full"
        bind:value={field.current}
    />
{:else if cell.kind === 'boolean'}
    <Select
        size="xs"
        items={[
            { label: labels.anyValue, value: ANY },
            { label: labels.yes, value: 'true' },
            { label: labels.no, value: 'false' }
        ]}
        aria-label={labels.filterRowValue(column.header)}
        class="w-full"
        bind:value={choice}
    />
{:else if cell.kind === 'set'}
    <!-- The panel's own control, inline: tick the values, search them when
         there are many. One condition still, whatever is ticked, so the line
         between this row and the panel does not move. -->
    <SelectMenu
        multiple
        size="xs"
        class="w-full"
        items={setItems}
        placeholder={labels.anyValue}
        ui={{ placeholder: 'text-on-surface-variant' }}
        searchPlaceholder={labels.searchValues}
        emptyText={labels.noData}
        aria-label={labels.filterRowValue(column.header)}
        bind:value={setField.current}
        onOpenChange={(open) => (listOpened ||= open)}
    />
{:else if cell.kind === 'summary'}
    <!-- A set of values, a second condition, a range: more than one field can
         hold, so the row says what is there and asks the panel to open.
         Asks rather than draws one: a column has a single panel, on its
         header, and a second instance of it would open alongside the first. -->
    <span class={slots.filterSummary({ class: theme('filterSummary') })}>{summary}</span>
    <Button
        variant="ghost"
        size="xs"
        icon="lucide:filter"
        color={entry ? 'primary' : 'secondary'}
        aria-label={labels.filterColumn(column.header)}
        aria-expanded={filteringState.filterFor === column.id}
        tabindex={-1}
        onclick={() => {
            filteringState.filterFor = filteringState.filterFor === column.id ? null : column.id
        }}
    />
{/if}
