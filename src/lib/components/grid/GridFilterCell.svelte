<script lang="ts" generics="TRow">
    import { untrack } from 'svelte'
    import { Button, Input, Select, useDebouncedState } from 'sv5ui'
    import {
        buildColumnFilter,
        describeFilter,
        filterTypeOf,
        filterUnitScaleOf,
        floatingCellOf,
        getFiltering
    } from '../../features/filtering/index.js'
    import { formatCellText } from '../../core/utils/index.js'
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

    const type = $derived(filterTypeOf(column.def))
    const scale = $derived(filterUnitScaleOf(column.def))
    const entry = $derived(filteringState.columnFilters[column.id])
    const cell = $derived(floatingCellOf(type, entry, scale))

    const inputType = $derived(type === 'number' ? 'number' : type === 'date' ? 'date' : 'text')

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

    let choice = $state(untrack(() => (cell.kind === 'boolean' ? cell.value : '')))

    $effect(() => {
        const value = choice
        untrack(() => {
            if (cell.kind !== 'boolean' || value === cell.value) return
            filteringState.setColumnFilter(
                column.id,
                value === '' ? null : { kind: 'boolean', value: value === 'true' }
            )
        })
    })

    $effect(() => {
        const value = cell.kind === 'boolean' ? cell.value : ''
        untrack(() => {
            if (value !== choice) choice = value
        })
    })
</script>

{#if cell.kind === 'input'}
    <Input
        type={inputType}
        size="xs"
        placeholder={type === 'text' ? labels.valuePlaceholder : undefined}
        aria-label={labels.filterColumn(column.header)}
        class="w-full"
        bind:value={field.current}
    />
{:else if cell.kind === 'boolean'}
    <Select
        size="xs"
        items={[
            { label: labels.clear, value: '' },
            { label: labels.yes, value: 'true' },
            { label: labels.no, value: 'false' }
        ]}
        aria-label={labels.filterColumn(column.header)}
        class="w-full"
        bind:value={choice}
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
