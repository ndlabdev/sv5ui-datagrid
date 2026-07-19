<script lang="ts">
    import { getPagination } from '../features/pagination/index.js'
    import { getGridContext } from './context.js'
    import type { GridStatusBarProps } from './datagrid.types.js'
    import { datagridVariants } from './datagrid.variants.js'

    let { class: className }: GridStatusBarProps = $props()

    const grid = getGridContext()
    const pagination = getPagination(grid)
    const slots = datagridVariants()

    const total = $derived(grid.sourceNodes.length)
    const filtered = $derived(grid.totalRows)
</script>

<div class={slots.statusBar({ class: className })}>
    <span>
        {filtered === total
            ? `${total.toLocaleString()} rows`
            : `${filtered.toLocaleString()} of ${total.toLocaleString()} rows`}
    </span>
    {#if pagination?.pageSize}
        <span>page {pagination.page} of {pagination.pageCount}</span>
    {/if}
</div>
