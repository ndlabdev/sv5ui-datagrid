<script lang="ts">
    import { Empty, Skeleton } from 'sv5ui'
    import { getVirtualization } from '../features/virtualization/index.js'
    import { getGridContext } from './context.js'
    import type { GridBodyProps } from './datagrid.types.js'
    import { datagridVariants } from './datagrid.variants.js'
    import { columnWindowOf, pinLeftVar, pinRightVar, windowStartOf } from './window.js'

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
    const pinnedCellClass = slots.pinnedCell()
    const boundaryClass = slots.groupBoundary()

    function withBoundary(base: string, index: number): string {
        return grid.columns.groupBoundaryFlags[index] ? `${base} ${boundaryClass}` : base
    }

    const windowStart = $derived(windowStartOf(grid))
    const columnWindow = $derived(columnWindowOf(grid))
    const headerRows = $derived(grid.columns.headerRowCount)

    function isActive(row: number, col: number): boolean {
        const active = grid.focus.active
        return active.row === row && active.col === col
    }

    function rowHeightOf(row: number): string | undefined {
        if (!virtualization) return undefined
        return `${virtualization.virtualizer.sizeOf(row)}px`
    }
</script>

{#snippet rows()}
    {#each grid.nodes as node, viewIndex (node.id)}
        {@const rowHeight = rowHeightOf(windowStart + viewIndex)}
        <div
            role="row"
            aria-rowindex={windowStart + viewIndex + 1 + headerRows}
            class={rowClass}
            style:height={rowHeight}
            style:--dg-row-h={rowHeight}
            style:width={columnWindow.rowWidth}
        >
            {#each columnWindow.renderColumns as entry (entry.column.id)}
                {@const column = entry.column}
                {@const colIndex = entry.index}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <div
                    role="gridcell"
                    aria-colindex={colIndex + 1}
                    tabindex={isActive(windowStart + viewIndex, colIndex) ? 0 : -1}
                    data-dg-cell="{windowStart + viewIndex}:{colIndex}"
                    class={withBoundary(
                        column.pinned
                            ? `${cellClass[column.align]} ${pinnedCellClass}`
                            : cellClass[column.align],
                        colIndex
                    )}
                    style:grid-column={columnWindow.windowed ? colIndex + 1 : undefined}
                    style:left={pinLeftVar(column)}
                    style:right={pinRightVar(column)}
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
        <div role="row" class={rowClass} style:width={columnWindow.rowWidth}>
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
            <div role="row" class={rowClass} style:width={columnWindow.rowWidth}>
                {#each columnWindow.renderColumns as entry (entry.column.id)}
                    <div
                        class={cellClass[entry.column.align]}
                        style:grid-column={columnWindow.windowed ? entry.index + 1 : undefined}
                    >
                        <Skeleton class="h-4 w-3/4" />
                    </div>
                {/each}
            </div>
        {/each}
    {:else if grid.totalRows === 0}
        <div role="row" class={rowClass} style:width={columnWindow.rowWidth}>
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
