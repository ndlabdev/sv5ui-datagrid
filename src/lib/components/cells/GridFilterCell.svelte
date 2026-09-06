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

    const type = $derived(filterTypeOf(column.def))
    const scale = $derived(filterUnitScaleOf(column.def))
    const entry = $derived(filteringState.columnFilters[column.id])
    const cell = $derived(floatingCellOf(type, entry, scale))

    const numberUi = { increment: 'hidden', decrement: 'hidden' }

    const dateFieldId = $props.id()

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

    const numberValue = $derived.by(() => {
        const raw = String(field.current ?? '')
        if (raw === '') return null
        const parsed = Number(raw)
        return Number.isFinite(parsed) ? parsed : null
    })

    function apply(raw: string): void {
        if (!type || cell.kind !== 'input') return
        filteringState.setColumnFilter(
            column.id,
            buildColumnFilter(
                type,
                {
                    join: 'and',
                    conditions: [{ op: cell.op, value: raw, to: '' }],
                    caseSensitive: cell.caseSensitive,
                    boolValue: 'true',
                    setSelected: []
                },
                scale
            )
        )
    }

    $effect(() => {
        const value = String(field.debounced ?? '')
        untrack(() => {
            if (cell.kind === 'input' && value !== cell.value) apply(value)
        })
    })

    $effect(() => {
        const value = cell.kind === 'input' ? cell.value : ''
        untrack(() => {
            if (value !== String(field.debounced ?? '')) field.setImmediate(value)
        })
    })

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

    function keyOf(value: SetFilterValue): string {
        if (value === null) return 'x:'
        const tag = typeof value === 'number' ? 'n' : typeof value === 'boolean' ? 'b' : 's'
        return `${tag}:${String(value)}`
    }

    const sameKeys = (a: string[], b: string[]) =>
        a.length === b.length && [...a].sort().join('\u0000') === [...b].sort().join('\u0000')

    const shownValue = (value: SetFilterValue) =>
        value === null
            ? labels.blankValue
            : (formatCellText(value, column.def, grid.locale) ?? String(value))

    let listOpened = $state(false)

    const setValues = $derived.by(() => {
        const ticked = cell.kind === 'set' ? cell.values : []
        if (!listOpened) return ticked
        const offered = filteringState.distinctFor(column.id)
        const known = new Set(offered.map(keyOf))
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
