<script lang="ts">
    import { getPagination } from '../../features/pagination/index.js'
    import { getSelection } from '../../features/selection/index.js'
    import { getTree } from '../../features/tree/index.js'
    import { getGridContext } from '../internal/context.js'
    import type { GridStatusBarProps } from '../datagrid.types.js'
    import { datagridVariants } from '../datagrid.variants.js'
    import { getGridTheme } from '../internal/theme.js'

    let { class: className }: GridStatusBarProps = $props()

    const grid = getGridContext()
    const pagination = getPagination(grid)
    const selectionState = getSelection(grid)
    const slots = datagridVariants()
    const theme = getGridTheme()

    const treeState = getTree(grid)
    const total = $derived(
        pagination?.server ? pagination.total : (treeState?.totalRows ?? grid.sourceNodes.length)
    )
    const filtered = $derived(
        pagination?.server ? total : (treeState?.filteredRows ?? grid.filteredRowCount)
    )
    const selected = $derived(selectionState?.count ?? 0)
</script>

<div class={slots.statusBar({ class: [theme('statusBar'), className] })}>
    <span>
        {filtered === total
            ? grid.labels.totalRows(total)
            : grid.labels.filteredRows(filtered, total)}
    </span>
    {#if selected > 0}
        <span class="text-primary">{grid.labels.selectedRows(selected)}</span>
    {/if}
</div>
