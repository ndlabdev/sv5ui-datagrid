<script lang="ts">
    import { Empty, Skeleton } from 'sv5ui'
    import { getVirtualization } from '../features/virtualization/index.js'
    import { getGridContext } from './context.js'
    import type { GridBodyProps } from './datagrid.types.js'
    import { datagridVariants } from './datagrid.variants.js'
    import { windowStartOf } from './window.js'

    let {
        emptyText = 'No data',
        loading = false,
        loadingRows = 5,
        error = null,
        onRetry,
        class: className
    }: GridBodyProps = $props()

    const grid = getGridContext()
    const virtualization = getVirtualization(grid)
    const slots = datagridVariants()

    const rowClass = slots.row()
    const cellClass = {
        left: slots.cell({ align: 'left' }),
        center: slots.cell({ align: 'center' }),
        right: slots.cell({ align: 'right' })
    } as const

    const windowStart = $derived(windowStartOf(grid))

    function isActive(row: number, col: number): boolean {
        const active = grid.focus.active
        return active.row === row && active.col === col
    }
</script>

{#snippet rows()}
    {#each grid.nodes as node, viewIndex (node.id)}
        <div
            role="row"
            aria-rowindex={windowStart + viewIndex + 2}
            class={rowClass}
            style:height={virtualization ? `${virtualization.virtualizer.rowHeight}px` : undefined}
            style:min-height={virtualization
                ? `${virtualization.virtualizer.rowHeight}px`
                : undefined}
        >
            {#each grid.columns.visible as column, colIndex (column.id)}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <div
                    role="gridcell"
                    aria-colindex={colIndex + 1}
                    tabindex={isActive(windowStart + viewIndex, colIndex) ? 0 : -1}
                    data-dg-cell="{windowStart + viewIndex}:{colIndex}"
                    class={cellClass[column.align]}
                    onclick={() =>
                        grid.focus.focusCell({ row: windowStart + viewIndex, col: colIndex })}
                >
                    {#if column.def.cell}
                        {@render column.def.cell({
                            node,
                            row: node.row,
                            value: grid.getValue(node, column),
                            rowIndex: windowStart + viewIndex
                        })}
                    {:else}
                        {grid.getValue(node, column)}
                    {/if}
                </div>
            {/each}
        </div>
    {/each}
{/snippet}

<div
    role="rowgroup"
    aria-busy={loading || undefined}
    class={slots.body({ class: className })}
    style:height={virtualization && !loading && !error && grid.totalRows > 0
        ? `${virtualization.virtualizer.totalHeight}px`
        : undefined}
>
    {#if error}
        <div role="row" class={rowClass}>
            <div
                role="gridcell"
                aria-colindex={1}
                class={slots.empty()}
                style="grid-column: 1 / -1"
            >
                <Empty
                    icon="lucide:circle-alert"
                    title={error}
                    variant="naked"
                    size="sm"
                    actions={onRetry ? [{ label: 'Retry', size: 'sm', onclick: onRetry }] : []}
                />
            </div>
        </div>
    {:else if loading}
        {#each Array.from({ length: loadingRows }, (_, i) => i) as i (i)}
            <div role="row" class={rowClass}>
                {#each grid.columns.visible as column (column.id)}
                    <div class={cellClass[column.align]}>
                        <Skeleton class="h-4 w-3/4" />
                    </div>
                {/each}
            </div>
        {/each}
    {:else if grid.totalRows === 0}
        <div role="row" class={rowClass}>
            <div
                role="gridcell"
                aria-colindex={1}
                class={slots.empty()}
                style="grid-column: 1 / -1"
            >
                <Empty icon="lucide:inbox" title={emptyText} variant="naked" size="sm" />
            </div>
        </div>
    {:else if virtualization}
        <div
            class={slots.bodyOffset()}
            style:transform={`translateY(${virtualization.virtualizer.offsetY}px)`}
        >
            {@render rows()}
        </div>
    {:else}
        {@render rows()}
    {/if}
</div>
