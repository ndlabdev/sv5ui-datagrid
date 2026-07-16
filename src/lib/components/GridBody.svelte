<script lang="ts">
    import { Empty } from 'sv5ui'
    import { getPagination } from '../features/pagination/index.js'
    import { getVirtualization } from '../features/virtualization/index.js'
    import { getGridContext } from './context.js'
    import type { GridBodyProps } from './datagrid.types.js'
    import { datagridVariants } from './datagrid.variants.js'

    let { emptyText = 'No data', class: className }: GridBodyProps = $props()

    const grid = getGridContext()
    const virtualization = getVirtualization(grid)
    const pagination = getPagination(grid)
    const slots = datagridVariants()

    const rowClass = slots.row()
    const cellClass = {
        left: slots.cell({ align: 'left' }),
        center: slots.cell({ align: 'center' }),
        right: slots.cell({ align: 'right' })
    } as const

    const windowStart = $derived(
        virtualization
            ? virtualization.virtualizer.range.start
            : pagination?.pageSize
              ? (pagination.page - 1) * pagination.pageSize
              : 0
    )
</script>

{#snippet rows()}
    {#each grid.nodes as node, viewIndex (node.id)}
        <div
            role="row"
            aria-rowindex={windowStart + viewIndex + 2}
            class={rowClass}
            style:height={virtualization ? `${virtualization.virtualizer.rowHeight}px` : undefined}
        >
            {#each grid.columns.visible as column, colIndex (column.id)}
                <div role="gridcell" aria-colindex={colIndex + 1} class={cellClass[column.align]}>
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
    class={slots.body({ class: className })}
    style:height={virtualization && grid.totalRows > 0
        ? `${virtualization.virtualizer.totalHeight}px`
        : undefined}
>
    {#if grid.totalRows === 0}
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
