<script lang="ts">
    import { Icon } from 'sv5ui'
    import { HEADER_ROW } from '../core/focus-model.svelte.js'
    import { getSorting } from '../features/sorting/index.js'
    import { columnWindowOf } from './window.js'
    import { getGridContext } from './context.js'
    import type { GridHeaderProps } from './datagrid.types.js'
    import { datagridVariants } from './datagrid.variants.js'

    let { class: className }: GridHeaderProps = $props()

    const grid = getGridContext()
    const sorting = getSorting(grid)
    const slots = datagridVariants()

    const columnWindow = $derived(columnWindowOf(grid))

    function isActive(index: number): boolean {
        const { row, col } = grid.focus.active
        return row === HEADER_ROW && col === index
    }

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

<div role="rowgroup" class={slots.header({ class: className })} style:width={columnWindow.rowWidth}>
    <div role="row" aria-rowindex={1} class={slots.headerRow()}>
        {#each columnWindow.renderColumns as column, viewCol (column.id)}
            {@const index = columnWindow.colStart + viewCol}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <div
                role="columnheader"
                aria-colindex={index + 1}
                aria-sort={ariaSort(column.id)}
                tabindex={isActive(index) ? 0 : -1}
                data-dg-cell="{HEADER_ROW}:{index}"
                class={slots.headerCell({ align: column.align })}
                style:grid-column={columnWindow.windowed ? index + 1 : undefined}
                onclick={() => grid.focus.focusCell({ row: HEADER_ROW, col: index })}
            >
                {#if sorting && column.def.sortable}
                    <button
                        type="button"
                        tabindex="-1"
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
