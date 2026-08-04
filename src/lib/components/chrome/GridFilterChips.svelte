<script lang="ts">
    import { Button } from 'sv5ui'
    import { describeFilter, getFiltering } from '../../features/filtering/index.js'
    import { getGridContext } from '../internal/context.js'
    import type { GridFilterChipsProps } from '../datagrid.types.js'
    import { datagridVariants } from '../datagrid.variants.js'
    import { getGridTheme } from '../internal/theme.js'

    let { class: className }: GridFilterChipsProps = $props()

    const grid = getGridContext()
    const filteringState = getFiltering(grid)
    const slots = datagridVariants()
    const theme = getGridTheme()

    const chips = $derived.by(() => {
        if (!filteringState) return []
        return Object.entries(filteringState.columnFilters).map(([columnId, filter]) => ({
            columnId,
            label: `${grid.columns.get(columnId)?.header ?? columnId}: ${describeFilter(filter, grid.labels)}`
        }))
    })
</script>

{#if filteringState && chips.length > 0}
    <div
        class={slots.filterChips({ class: [theme('filterChips'), className] })}
        role="group"
        aria-label={grid.labels.activeFilters}
    >
        {#each chips as chip (chip.columnId)}
            <Button
                variant="soft"
                size="xs"
                icon="lucide:x"
                trailing
                label={chip.label}
                aria-label={grid.labels.removeFilter(chip.label)}
                onclick={() => filteringState.setColumnFilter(chip.columnId, null)}
            />
        {/each}
        {#if chips.length > 1}
            <Button
                variant="ghost"
                size="xs"
                label={grid.labels.clearAllFilters}
                onclick={filteringState.clearColumnFilters}
            />
        {/if}
    </div>
{/if}
