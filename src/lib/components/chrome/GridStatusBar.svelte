<script lang="ts">
    import { getPagination } from '../../features/pagination/index.js'
    import { getRowPinning } from '../../features/row-pinning/index.js'
    import { getSelection } from '../../features/selection/index.js'
    import { getGridContext } from '../internal/context.js'
    import type { GridStatusBarProps } from '../datagrid.types.js'
    import { datagridVariants } from '../datagrid.variants.js'
    import { getGridTheme } from '../internal/theme.js'

    let { class: className }: GridStatusBarProps = $props()

    const grid = getGridContext()
    const pagination = getPagination(grid)
    const selectionState = getSelection(grid)
    const pinning = getRowPinning(grid)
    const slots = datagridVariants()
    const theme = getGridTheme()

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

<div class={slots.statusBar({ class: [theme('statusBar'), className] })}>
    <span>
        {filtered === total
            ? `${total.toLocaleString()} rows`
            : `${filtered.toLocaleString()} of ${total.toLocaleString()} rows`}
    </span>
    {#if selected > 0}
        <span class="text-primary">{selected.toLocaleString()} selected</span>
    {/if}
</div>
