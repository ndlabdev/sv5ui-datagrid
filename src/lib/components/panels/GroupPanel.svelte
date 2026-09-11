<script lang="ts" generics="TRow">
    import { untrack } from 'svelte'
    import { Button, DropdownMenu, Icon } from 'sv5ui'
    import { getGrouping } from '../../features/grouping/grouping.svelte.js'
    import { datagridVariants } from '../datagrid.variants.js'
    import type { GridState } from '$lib/index.js'
    import { getGridContext } from '../internal/context.js'
    import { getGridTheme } from '../internal/theme.js'

    const slots = datagridVariants()

    let {
        grid: gridProp,
        placeholder,
        class: className
    }: {
        grid?: GridState<TRow>
        placeholder?: string
        class?: string
    } = $props()

    const grid = untrack(() => gridProp) ?? getGridContext<TRow>()
    const theme = getGridTheme(grid)

    const grouping = $derived(getGrouping(grid))
    const t = $derived(grid.labels)

    const chips = $derived(
        (grouping?.by ?? []).map((columnId) => ({
            id: columnId,
            header: grid.columns.get(columnId)?.header ?? columnId
        }))
    )

    const addItems = $derived(
        (grouping?.groupableColumns() ?? []).map((column) => ({
            label: column.header,
            onSelect: () => grouping?.groupBy(column.id)
        }))
    )
</script>

{#if grouping}
    <div data-dg-group-panel class={slots.groupPanel({ class: [theme('groupPanel'), className] })}>
        <span class={slots.groupPanelLabel({ class: theme('groupPanelLabel') })}>{t.groupBy}</span>

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
                        aria-label={t.moveGroupEarlier(chip.header)}
                        disabled={index === 0}
                        onclick={() => grouping.moveGroup(chip.id, -1)}
                    />
                    <Button
                        variant="ghost"
                        size="xs"
                        icon="lucide:chevron-right"
                        aria-label={t.moveGroupLater(chip.header)}
                        disabled={index === chips.length - 1}
                        onclick={() => grouping.moveGroup(chip.id, 1)}
                    />
                    <Button
                        variant="ghost"
                        size="xs"
                        icon="lucide:x"
                        aria-label={t.removeGroup(chip.header)}
                        onclick={() => grouping.ungroup(chip.id)}
                    />
                </span>
            </span>
        {/each}

        {#if chips.length === 0}
            <span class={slots.groupPanelEmpty({ class: theme('groupPanelEmpty') })}>
                {placeholder ?? t.groupPanelEmpty}
            </span>
        {/if}

        <div class="grow"></div>

        {#if addItems.length > 0}
            <DropdownMenu items={addItems}>
                {#snippet children({ props })}
                    <Button
                        {...props}
                        variant="outline"
                        size="xs"
                        icon="lucide:plus"
                        label={t.addGroup}
                    />
                {/snippet}
            </DropdownMenu>
        {/if}

        {#if chips.length > 0}
            <Button
                variant="ghost"
                size="xs"
                label={t.clearGroups}
                onclick={() => grouping.clearGrouping()}
            />
        {/if}
    </div>
{/if}
