<script lang="ts">
    import { getPagination } from '../features/pagination/index.js'
    import { getRowPinning } from '../features/row-pinning/index.js'
    import { getSelection } from '../features/selection/index.js'
    import { getGridContext } from './context.js'
    import type { GridStatusBarProps } from './datagrid.types.js'
    import { datagridVariants } from './datagrid.variants.js'

    let { class: className }: GridStatusBarProps = $props()

    const grid = getGridContext()
    const pagination = getPagination(grid)
    const selectionState = getSelection(grid)
    const pinning = getRowPinning(grid)
    const slots = datagridVariants()

    // In server mode only one page is in memory, so the counts have to come
    // from the server total rather than from the nodes on hand.
    const total = $derived(pagination?.server ? pagination.total : grid.sourceNodes.length)
    const filtered = $derived(
        pagination?.server
            ? total
            : grid.preWindowNodes.reduce(
                  (count, node) => (node.meta?.fullWidth ? count : count + 1),
                  pinning?.pinnedCount ?? 0
              )
    )
    const selected = $derived(selectionState?.count ?? 0)
</script>

<div class={slots.statusBar({ class: className })}>
    <span>
        {filtered === total
            ? `${total.toLocaleString()} rows`
            : `${filtered.toLocaleString()} of ${total.toLocaleString()} rows`}
        {#if selected > 0}
            · {selected.toLocaleString()} selected
        {/if}
    </span>
    {#if pagination?.pageSize}
        <span>page {pagination.page} of {pagination.pageCount}</span>
    {/if}
</div>
