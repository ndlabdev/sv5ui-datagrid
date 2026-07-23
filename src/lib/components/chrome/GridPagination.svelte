<script lang="ts">
    import { Pagination, Select } from 'sv5ui'
    import { getPagination } from '../../features/pagination/index.js'
    import { getGridContext } from '../internal/context.js'
    import type { GridPaginationProps } from '../datagrid.types.js'
    import { datagridVariants } from '../datagrid.variants.js'
    import { getGridTheme } from '../internal/theme.js'

    let { pageSizes = [10, 25, 50, 100], class: className }: GridPaginationProps = $props()

    const grid = getGridContext()
    const pagination = getPagination(grid)
    const slots = datagridVariants()
    const theme = getGridTheme()

    // The active page size may not be one of the offered choices — a grid can
    // be created with any `pageSize`. Fold it in and keep the list sorted, so
    // the Select always has an item to show its value against instead of
    // rendering blank.
    const sizeItems = $derived(
        [...new Set([...pageSizes, pagination?.pageSize].filter((size): size is number => !!size))]
            .sort((a, b) => a - b)
            .map((size) => ({ label: `${size} / page`, value: String(size) }))
    )
    const rangeStart = $derived(
        pagination?.pageSize ? (pagination.page - 1) * pagination.pageSize + 1 : 1
    )
    const total = $derived(pagination?.total ?? grid.totalRows)
    const rangeEnd = $derived(
        pagination?.pageSize ? Math.min(pagination.page * pagination.pageSize, total) : total
    )
</script>

{#if pagination && pagination.pageSize && total > 0}
    <div class={slots.footer({ class: [theme('footer'), className] })}>
        <span class="me-auto text-xs whitespace-nowrap text-on-surface-variant sm:me-0">
            {rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()} of {total.toLocaleString()}
        </span>
        <Select
            class="w-32"
            size="sm"
            items={sizeItems}
            aria-label="Rows per page"
            bind:value={
                () => String(pagination.pageSize), (value) => pagination.setPageSize(Number(value))
            }
        />
        {#if total > pagination.pageSize}
            <Pagination
                size="sm"
                {total}
                itemsPerPage={pagination.pageSize}
                bind:page={() => pagination.page, (page) => pagination.setPage(page)}
            />
        {/if}
    </div>
{/if}
