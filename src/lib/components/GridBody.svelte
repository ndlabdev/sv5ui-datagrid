<script lang="ts">
    import { getGridContext } from './context.js'
    import type { GridBodyProps } from './datagrid.types.js'
    import { datagridVariants } from './datagrid.variants.js'

    let { emptyText = 'No data', class: className }: GridBodyProps = $props()

    const grid = getGridContext()
    const slots = datagridVariants()

    const rowIndexById = $derived(
        new Map(grid.preWindowNodes.map((node, index) => [node.id, index]))
    )
</script>

<div role="rowgroup" class={slots.body({ class: className })}>
    {#if grid.nodes.length === 0}
        <div role="row" class={slots.row()}>
            <div
                role="gridcell"
                aria-colindex={1}
                class={slots.empty()}
                style="grid-column: 1 / -1"
            >
                {emptyText}
            </div>
        </div>
    {:else}
        {#each grid.nodes as node, rowIndex (node.id)}
            <div
                role="row"
                aria-rowindex={(rowIndexById.get(node.id) ?? 0) + 2}
                class={slots.row()}
            >
                {#each grid.columns.visible as column, colIndex (column.id)}
                    <div
                        role="gridcell"
                        aria-colindex={colIndex + 1}
                        class={slots.cell({ align: column.align })}
                    >
                        {#if column.def.cell}
                            {@render column.def.cell({
                                node,
                                row: node.row,
                                value: grid.getValue(node, column),
                                rowIndex
                            })}
                        {:else}
                            {grid.getValue(node, column)}
                        {/if}
                    </div>
                {/each}
            </div>
        {/each}
    {/if}
</div>
