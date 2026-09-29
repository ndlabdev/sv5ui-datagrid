<script lang="ts" generics="TRow">
    import { untrack } from 'svelte'
    import { Button, DropdownMenu, Icon } from 'sv5ui'
    import { getPivot } from '../../features/pivot/pivot.svelte.js'
    import type { PivotShowAs } from '../../features/pivot/pivot.types.js'
    import type { Aggregation } from '../../features/grouping/grouping.types.js'
    import { datagridVariants } from '../datagrid.variants.js'
    import type { GridState } from '$lib/index.js'
    import { getGridContext } from '../internal/context.js'
    import { getGridTheme } from '../internal/theme.js'

    const slots = datagridVariants()

    let {
        grid: gridProp,
        class: className
    }: {
        grid?: GridState<TRow>
        class?: string
    } = $props()

    const grid = untrack(() => gridProp) ?? getGridContext<TRow>()
    const theme = getGridTheme(grid)

    const pivot = $derived(getPivot(grid))
    const t = $derived(grid.labels)

    const AGGREGATIONS: Aggregation<TRow>[] = [
        'sum',
        'avg',
        'count',
        'min',
        'max',
        'median',
        'distinctCount',
        'first',
        'last'
    ]

    const SHARES: (PivotShowAs | undefined)[] = [
        undefined,
        'percentOfRow',
        'percentOfColumn',
        'percentOfTotal'
    ]

    const headerOf = (id: string) => grid.columns.get(id)?.header ?? id

    const free = $derived(pivot?.pivotableColumns() ?? [])

    const shareLabel = (showAs: PivotShowAs | undefined) =>
        showAs === undefined ? t.pivotShareNone : showAs

    function axis(fields: string[], move: (field: string, offset: number) => void) {
        return fields.map((field, index) => ({
            id: field,
            header: headerOf(field),
            first: index === 0,
            last: index === fields.length - 1,
            move
        }))
    }

    const rowChips = $derived(axis(pivot?.rows ?? [], (f, o) => pivot?.moveRowField(f, o)))
    const columnChips = $derived(axis(pivot?.columns ?? [], (f, o) => pivot?.moveColumnField(f, o)))

    const addTo = (take: (id: string) => void) =>
        free.map((column) => ({ label: column.header, onSelect: () => take(column.id) }))
</script>

{#snippet zone(
    key: string,
    label: string,
    chips: ReturnType<typeof axis>,
    add: (id: string) => void,
    addLabel: string
)}
    <div
        role="group"
        aria-label={label}
        data-dg-pivot-zone={key}
        class={slots.groupPanel({ class: theme('groupPanel') })}
    >
        <span class={slots.groupPanelLabel({ class: theme('groupPanelLabel') })}>{label}</span>

        {#each chips as chip, index (chip.id)}
            <span class="inline-flex items-center gap-0.5">
                {#if index > 0}
                    <Icon
                        name="lucide:chevron-right"
                        class={slots.groupPanelSeparator({ class: theme('groupPanelSeparator') })}
                    />
                {/if}
                <span class={slots.groupPanelChip({ class: theme('groupPanelChip') })}>
                    <span class={slots.groupPanelChipLabel({ class: theme('groupPanelChipLabel') })}
                        >{chip.header}</span
                    >
                    <Button
                        variant="ghost"
                        size="xs"
                        icon="lucide:chevron-left"
                        aria-label={t.movePivotEarlier(chip.header)}
                        disabled={chip.first}
                        onclick={() => chip.move(chip.id, -1)}
                    />
                    <Button
                        variant="ghost"
                        size="xs"
                        icon="lucide:chevron-right"
                        aria-label={t.movePivotLater(chip.header)}
                        disabled={chip.last}
                        onclick={() => chip.move(chip.id, 1)}
                    />
                    <Button
                        variant="ghost"
                        size="xs"
                        icon="lucide:x"
                        aria-label={t.removePivotChip(chip.header)}
                        onclick={() => pivot?.removeField(chip.id)}
                    />
                </span>
            </span>
        {/each}

        <div class="grow"></div>

        {#if free.length > 0}
            <DropdownMenu items={addTo(add)}>
                {#snippet children({ props })}
                    <Button
                        {...props}
                        variant="outline"
                        size="xs"
                        icon="lucide:plus"
                        label={addLabel}
                    />
                {/snippet}
            </DropdownMenu>
        {/if}
    </div>
{/snippet}

{#if pivot}
    <div data-dg-pivot-panel class={['space-y-2', className]}>
        {@render zone('rows', t.pivotRows, rowChips, (id) => pivot.addRowField(id), t.addPivotRow)}
        {@render zone(
            'columns',
            t.pivotColumns,
            columnChips,
            (id) => pivot.addColumnField(id),
            t.addPivotColumn
        )}

        <div
            role="group"
            aria-label={t.pivotValues}
            data-dg-pivot-zone="values"
            class={slots.groupPanel({ class: theme('groupPanel') })}
        >
            <span class={slots.groupPanelLabel({ class: theme('groupPanelLabel') })}
                >{t.pivotValues}</span
            >

            {#each pivot.values as measure, index (`${measure.field}-${index}`)}
                <span class={slots.groupPanelChip({ class: theme('groupPanelChip') })}>
                    <span class={slots.groupPanelChipLabel({ class: theme('groupPanelChipLabel') })}
                        >{headerOf(measure.field)}</span
                    >

                    <DropdownMenu
                        items={AGGREGATIONS.map((agg) => ({
                            label: String(agg),
                            onSelect: () => pivot.setValueAgg(index, agg)
                        }))}
                    >
                        {#snippet children({ props })}
                            <Button
                                {...props}
                                variant="ghost"
                                size="xs"
                                label={String(measure.agg)}
                                aria-label={t.pivotAggregation}
                            />
                        {/snippet}
                    </DropdownMenu>

                    <DropdownMenu
                        items={SHARES.map((showAs) => ({
                            label: shareLabel(showAs),
                            onSelect: () => pivot.setValueShowAs(index, showAs)
                        }))}
                    >
                        {#snippet children({ props })}
                            <Button
                                {...props}
                                variant="ghost"
                                size="xs"
                                label={shareLabel(measure.showAs)}
                                aria-label={t.pivotShare}
                            />
                        {/snippet}
                    </DropdownMenu>

                    <Button
                        variant="ghost"
                        size="xs"
                        icon="lucide:x"
                        aria-label={t.removePivotChip(headerOf(measure.field))}
                        onclick={() => pivot.removeValue(index)}
                    />
                </span>
            {/each}

            {#if !pivot.isCrossing}
                <span class={slots.groupPanelEmpty({ class: theme('groupPanelEmpty') })}>
                    {t.pivotPanelEmpty}
                </span>
            {/if}

            <div class="grow"></div>

            {#if free.length > 0}
                <DropdownMenu items={addTo((id) => pivot.addValue(id))}>
                    {#snippet children({ props })}
                        <Button
                            {...props}
                            variant="outline"
                            size="xs"
                            icon="lucide:plus"
                            label={t.addPivotValue}
                        />
                    {/snippet}
                </DropdownMenu>
            {/if}

            {#if pivot.isCrossing}
                <Button
                    variant="ghost"
                    size="xs"
                    label={t.clearPivotAll}
                    onclick={() => pivot.clearPivot()}
                />
            {/if}
        </div>
    </div>
{/if}
