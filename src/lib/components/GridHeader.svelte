<script lang="ts">
    import { Icon } from 'sv5ui'
    import { getSorting } from '../features/sorting/index.js'
    import { getGridContext } from './context.js'
    import type { GridHeaderProps } from './datagrid.types.js'
    import { datagridVariants } from './datagrid.variants.js'

    let { class: className }: GridHeaderProps = $props()

    const grid = getGridContext()
    const sorting = getSorting(grid)
    const slots = datagridVariants()

    function ariaSort(columnId: string): 'ascending' | 'descending' | undefined {
        const direction = sorting?.directionOf(columnId)
        if (!direction) return undefined
        return direction === 'asc' ? 'ascending' : 'descending'
    }

    function sortIcon(columnId: string): string {
        const direction = sorting?.directionOf(columnId)
        if (!direction) return 'lucide:chevrons-up-down'
        return direction === 'asc' ? 'lucide:chevron-up' : 'lucide:chevron-down'
    }
</script>

<div role="rowgroup" class={slots.header({ class: className })}>
    <div role="row" aria-rowindex={1} class={slots.headerRow()}>
        {#each grid.columns.visible as column, index (column.id)}
            <div
                role="columnheader"
                aria-colindex={index + 1}
                aria-sort={ariaSort(column.id)}
                class={slots.headerCell({ align: column.align })}
            >
                {#if sorting && column.def.sortable}
                    <button
                        type="button"
                        class={slots.sortButton()}
                        onclick={() => sorting.toggleSort(column.id)}
                    >
                        {column.header}
                        <Icon name={sortIcon(column.id)} class="size-3.5" />
                    </button>
                {:else}
                    {column.header}
                {/if}
            </div>
        {/each}
    </div>
</div>
